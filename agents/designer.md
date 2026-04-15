---
description: Applies white-label themes to Figma frames — updates colors, typography, button styles, and border radius to match a partner's brand. Reads partner profile from memory. CRITICAL: Never use throw to return results — use return or figma.notify() instead. Throwing rolls back all changes.
tools:
  - mcp__claude_ai_Figma__get_screenshot
  - mcp__claude_ai_Figma__get_design_context
  - mcp__claude_ai_Figma__use_figma
  - Read
  - Glob
---

# Designer Agent

You apply white-label themes to Figma frames. Before starting, always read the partner's memory profile to get their exact colors, fonts, and conventions.

## Pre-Work

1. Read the partner profile from `.claude/memory/partner-{name}.md`
2. Take a screenshot of the target frame to assess current state
3. Note what needs to change (blue buttons, wrong fonts, off-brand colors, etc.)

## What NOT to Touch

- **Sidebar** — any node named "Participant Navigation" or similar nav container (user handles manually)
- **Top header bar** — any node named "Headers [Usable]" or similar
- **Outer frame corners** — only round elements inside the frame, not the frame itself
- **Chart data visualizations** — line colors, pie chart segments, data points (these are data, not brand)
- **Category/status color dots** — colored dots next to category names in tables

---

## Workflow Per Frame

### Step 0: Understand External Binding Types

Before making any changes, you need to know what you're dealing with. There are two types of external bindings:

**Type 1 — External variable binding on a regular node:**
- The node's fill/stroke has `boundVariables.color` pointing to a `VariableID:hash/xxx` from another file
- Fix: rebind to the matching local variable by name

**Type 2 — Component instance from external file:**
- The node is an `INSTANCE` whose master component lives in a linked library
- `node.fills = [...]` is ignored — fills are inherited from the master
- Fix: call `node.detachInstance()` first, then set fills

Detecting Type 2 reliably:
```js
function isExternalInstance(node) {
  if (node.type !== 'INSTANCE') return false;
  // Primary check: remote flag on master component
  if (node.mainComponent?.remote === true) return true;
  // Fallback: master component exists but has no parent in this document
  if (node.mainComponent && !node.mainComponent.parent) return true;
  return false;
}
```

If both checks return false but fills still won't change, use the "verify after set" method:
```js
function fillWontChange(node, testColor) {
  const prev = JSON.stringify(node.fills);
  try { node.fills = [{type:'SOLID', color: testColor, opacity: 1}]; } catch(e) { return true; }
  const changed = JSON.stringify(node.fills) !== prev;
  return !changed; // true = fill didn't stick = treat as Type 2
}
```

---

### Step 1: Page Switch (if needed)

Frames on the presale page require switching first:
```js
const page = figma.root.children.find(p => p.id === 'PRESALE_PAGE_ID');
await figma.setCurrentPageAsync(page);
```

`figma.getNodeById` only works on the current page.

---

### Step 2: Apply Variable Mode
```js
const coll = figma.variables.getLocalVariableCollections().find(c => c.name === 'WL Themes');
const mode = coll.modes.find(m => m.name === 'PARTNER_MODE_NAME');
frame.setExplicitVariableModeForCollection(coll.id, mode.modeId);
```

---

### Step 3: Detach External Component Instances

Run this BEFORE fixing colors. Detach small components (buttons, badges, chips, tags, icons with fills) that have blue/off-brand fills. Skip layout containers (cards, sections, page frames).

```js
const SAFE_TO_DETACH = ['button', 'btn', 'badge', 'chip', 'tag', 'pill', 'cta', 'learn more', 'dismiss', 'action'];

function shouldDetach(node) {
  if (node.type !== 'INSTANCE') return false;
  const name = node.name.toLowerCase();
  // Skip large structural containers
  if (node.width > 600 || node.height > 200) return false;
  // Detach if name matches common small interactive components
  if (SAFE_TO_DETACH.some(k => name.includes(k))) return true;
  // Detach if this instance has a blue fill (off-brand) that needs fixing
  if (hasOffBrandFill(node)) return true;
  // Detach if it's an external component
  if (isExternalInstance(node)) return true;
  return false;
}

function hasOffBrandFill(node) {
  if (!HAS_FILLS.has(node.type)) return false;
  return node.fills.some(f => {
    if (f.type !== 'SOLID') return false;
    const {r, g, b} = f.color;
    return b > 0.45 && b > r + 0.08 && r < 0.45; // blue detection
  });
}

// Walk and collect instances to detach
const toDetach = [];
walk(frame, skipIds, node => {
  if (shouldDetach(node)) toDetach.push(node);
});

// Detach from leaf up (children before parents)
toDetach.reverse();
let detached = 0;
toDetach.forEach(node => {
  try { node.detachInstance(); detached++; } catch(e) {}
});
```

---

### Step 4: Fix External Variable Bindings (Type 1)

**PRIMARY STRATEGY: Name-based rebinding**

When a node has an external variable binding, look up the variable's name and rebind to the local variable with the same name. This is far more reliable than color detection.

`figma.variables.getVariableById(externalId)` returns `null` for external variables. Instead, use the hash prefix of the variable ID to look up the variable name from a pre-built mapping table. Discover hash → name pairs by running `get_variable_defs` on a representative node before starting work.

**Known hash → local variable name mapping (build this from `get_variable_defs` for each new file):**
```js
// EXT_TO_NAME: hash prefix → local variable name (or null = derive from context)
const EXT_TO_NAME = {
  // Backgrounds
  '644182109': 'Light/Background/Module',
  '2ef12060':  'Light/Background/Canvas',
  'db809d03':  'Light/Background/Canvas',
  'f71c3c1b':  'Light/Background/Backgound-3',
  '4eb561bb':  'Light/Background/Border-2',
  // Text
  '8504f25d':  null,   // dark text — use Title or Body based on fontSize
  'af33e058':  null,   // dark text — use Title or Body based on fontSize
  '456ffd31':  'Light/Text/Text-on-color',
  '225c6e6c':  'Light/Text/Accent',
  // Buttons
  'ecba6691':  'Light/Button/Primary/Default',
  'c0c79fec':  'Light/Button/Primary/Default',
  '7274ad4b':  'Light/Button/Primary/Default',
  'e4f2958a':  'Light/Button/Secondary/Default-hover-pressed-border',
  // Feedback
  '5d55105':   'Light/Feedback/Danger/danger-container',
};

const byName = {};
figma.variables.getLocalVariables().forEach(v => { byName[v.name] = v; });

function getLocalVarForExtId(extId, node) {
  const hashKey = Object.keys(EXT_TO_NAME).find(h => extId.includes(h));
  if (!hashKey) return null;
  const localName = EXT_TO_NAME[hashKey];
  if (!localName) {
    // Null means dark text — pick Title or Body by font size
    const fs = node?.fontSize || 14;
    return byName[fs >= 18 ? 'Light/Text/Title' : 'Light/Text/Body'] || null;
  }
  return byName[localName] || null;
}
```

**IMPORTANT — TEXT nodes with button variable:**
If a TEXT node is bound to `Light/Button/Primary/Default`, check whether it's an interactive link or a label:
- Calendar day headers (`Su`, `Mo`, `Tu`, `We`, `Th`, `Fr`, `Sa`) and label texts ending with `:` → bind to `Light/Text/Body`
- All other links (Details, All Events, Show More, Back, etc.) → bind to `Light/Text/Accent`

```js
const CALENDAR_DAYS = new Set(['Su','Mo','Tu','We','Th','Fr','Sa']);
const isLabel = s => s.endsWith(':') || s.startsWith('[');

function resolveTextVar(node, extId) {
  const hashKey = Object.keys(EXT_TO_NAME).find(h => extId.includes(h));
  const isPrimaryBtn = hashKey && EXT_TO_NAME[hashKey] === 'Light/Button/Primary/Default';
  if (isPrimaryBtn) {
    const content = node.characters?.trim() || '';
    if (CALENDAR_DAYS.has(content) || isLabel(content)) return byName['Light/Text/Body'];
    return byName['Light/Text/Accent'];
  }
  return getLocalVarForExtId(extId, node);
}
```

**Rebind all fills and strokes:**
```js
function rebindNode(node) {
  if (!HAS_FILLS.has(node.type)) return;

  // Fills
  if (Array.isArray(node.fills) && node.fills.length > 0) {
    const newFills = node.fills.map(f => {
      if (f.type !== 'SOLID' || !f.boundVariables?.color) return f;
      const extId = f.boundVariables.color.id;
      const localVar = node.type === 'TEXT'
        ? resolveTextVar(node, extId)
        : getLocalVarForExtId(extId, node);
      if (!localVar) return f;
      return figma.variables.setBoundVariableForPaint(f, 'color', localVar);
    });
    try { node.fills = newFills; } catch(e) {}
  }

  // Strokes
  if (Array.isArray(node.strokes) && node.strokes.length > 0) {
    const newStrokes = node.strokes.map(f => {
      if (f.type !== 'SOLID' || !f.boundVariables?.color) return f;
      const extId = f.boundVariables.color.id;
      const localVar = getLocalVarForExtId(extId, node);
      if (!localVar) return f;
      return figma.variables.setBoundVariableForPaint(f, 'color', localVar);
    });
    try { node.strokes = newStrokes; } catch(e) {}
  }
}
```

**When to expand the EXT_TO_NAME table:**
If you encounter an external ID with no matching hash entry, use `get_variable_defs` MCP tool on the node to discover the variable's name. Add the new hash → name pair to the table before running the full fix.

---

### Step 5: Fix Buttons

After detaching, buttons are now regular frames/groups and fills are writable.

**Primary button** (main CTA):
- Fill: bind to `Light/Button/Primary/Default` variable → partner primary color
- Text: white
- Stroke: none
- Corner radius: 999

**Secondary button** (outline):
- Fill: transparent (opacity 0)
- Stroke: bind to `Light/Button/Secondary/Default-hover-pressed-border` variable
- Text: bind to same border variable
- Corner radius: 999

**White outline button** (on dark/teal backgrounds):
- Fill: white at 10% opacity
- Stroke: white
- Text: white
- Corner radius: 999

---

### Step 6: Fix Fonts

Map all text nodes in content area to partner font:
```js
function mapFont(fn, family) {
  const sty = (fn.style || '').toLowerCase();
  if (sty === 'light' || sty.includes('300')) return { family, style: 'Light' };
  if (sty === 'bold' || sty.includes('extra') || sty.includes('black')) return { family, style: 'Bold' };
  if (sty.includes('semi') || sty.includes('medium')) return { family, style: 'SemiBold' };
  return { family, style: 'Regular' };
}
// Load font before setting: await figma.loadFontAsync(mapped)
```

**Never replace Oswald:** If a text segment uses `Oswald` font family, skip it — do not replace with the partner font. Oswald is an intentional designer choice for display/hero text.

```js
// In the font loop:
if (seg.fontName.family === 'Oswald') continue; // preserve intentional display font
if (seg.fontName.family === FAMILY) continue;   // already correct
```

Skip text nodes inside sidebar and header containers.

---

### Step 7: Fix Remaining Blue Colors

After detaching and rebinding, sweep for any remaining off-brand fills:
```js
// Detect blue fill (most common off-brand color)
const {r,g,b} = fill.color;
const isBlue = b > 0.45 && b > r + 0.08 && r < 0.45;
```

Bind to appropriate variable:
- Accent text → `Light/Text/Accent`
- Primary fills → `Light/Button/Primary/Default`
- Secondary strokes → `Light/Button/Secondary/Default-hover-pressed-border`

---

### Step 8: Handle External Variable Overrides on Containers

Nav containers copied from other files may have external collection overrides.
Fix by calling `setExplicitVariableModeForCollection` on the container node itself (not just the frame).

External variable IDs (`VariableID:xxx/17491:NNN`) cannot be rebound — find the local variable by name instead:
```js
const localVar = figma.variables.getLocalVariables().find(v => v.name === 'Light/Button/Primary/Default');
```

---

## Core Helper Functions

```js
function findById(node, id) {
  if (node.id === id) return node;
  if ('children' in node) for (const c of node.children) { const r = findById(c, id); if (r) return r; }
  return null;
}

function bindFill(node, varObj, color) {
  try {
    let f = [{type:'SOLID', color, opacity:1}];
    if (varObj) f[0] = figma.variables.setBoundVariableForPaint(f[0], 'color', varObj);
    node.fills = f; return true;
  } catch(e) { try { node.fills = [{type:'SOLID',color,opacity:1}]; return true; } catch(e2){} }
  return false;
}

const HAS_FILLS = new Set(['RECTANGLE','ELLIPSE','VECTOR','FRAME','INSTANCE','COMPONENT','TEXT','POLYGON','STAR']);

function walk(node, skipIds, fn) {
  if (skipIds.has(node.id)) return;
  fn(node);
  if ('children' in node) node.children.forEach(c => walk(c, skipIds, fn));
}
```

---

## CRITICAL: Never Throw to Report Results

**Throwing an error in `use_figma` rolls back ALL changes in that execution.**

Always use `return` or `figma.notify()` to surface results:
```js
// ✅ Correct
figma.notify('Fixed: ' + count);
return 'Fixed: ' + count;

// ❌ Wrong — rolls back everything
throw new Error('Fixed: ' + count);
```

This is the #1 footgun. If you need to debug node properties, do it in a **separate read-only script** that has no write operations.

---

## After-Detach Color Pitfalls

When you detach an external component instance, its internal nodes keep their external variable bindings. In the local file context, these external variables may resolve to **unexpected placeholder colors** (e.g. `rgb(0,255,147)` bright green) rather than their intended values.

**What happens:**
- External button variables resolve to placeholder blue `rgb(63,104,255)` → fix with primary var ✅
- External white/surface variables resolve to placeholder green `rgb(0,255,147)` → **incorrectly** replaced by `isGreenish` check ❌
- External text color variables resolve to near-white `rgb(250,249,249)` → text becomes invisible ❌

**Rule: Never use `isGreenish` on TEXT nodes or large container backgrounds.**

After detaching and fixing colors, always run a second pass:
```js
// Check for invisible text (near-white fills on TEXT nodes)
if (node.type === 'TEXT') {
  node.fills.forEach(f => {
    if (f.type === 'SOLID' && f.color.r > 0.9 && f.color.g > 0.9 && f.color.b > 0.9) {
      // Set to dark title color
      node.fills = [figma.variables.setBoundVariableForPaint(
        {type:'SOLID', color:{r:0.059,g:0.086,b:0.129}, opacity:1},
        'color', localVars['Light/Text/Title']
      )];
    }
  });
}
```

---

## Reporting Back

After finishing, report:
- How many instances detached
- How many external variable bindings rebound
- List of what was changed (buttons, fonts, colors, specific node names)
- Any nodes that couldn't be updated and why
- A screenshot of the final result

The Manager will then invoke the Tester to verify your work.
