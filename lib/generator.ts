import { Theme, ThemeColor, ColorValue, ColorAnalysis, HSLDelta } from "../types";
import {
  colorDistance,
  getHSLDelta,
  applyHSLDelta,
  colorValueToHsl,
} from "./color-utils";

interface ColorMapping {
  colorName: string;
  primaryIndex: number; // Which primary color this maps to
  averageDelta: HSLDelta;
}

function findNearestPrimary(
  color: ColorValue,
  primaries: ColorValue[]
): number {
  let minDist = Infinity;
  let idx = 0;
  for (let i = 0; i < primaries.length; i++) {
    const d = colorDistance(color, primaries[i]);
    if (d < minDist) {
      minDist = d;
      idx = i;
    }
  }
  return idx;
}

function averageDeltas(deltas: HSLDelta[]): HSLDelta {
  if (deltas.length === 0) return { dh: 0, ds: 0, dl: 0 };
  const sum = deltas.reduce(
    (acc, d) => ({
      dh: acc.dh + d.dh,
      ds: acc.ds + d.ds,
      dl: acc.dl + d.dl,
    }),
    { dh: 0, ds: 0, dl: 0 }
  );
  return {
    dh: sum.dh / deltas.length,
    ds: sum.ds / deltas.length,
    dl: sum.dl / deltas.length,
  };
}

export function buildMappingModel(
  themes: Theme[],
  primaryColorNames: string[],
  analysis: ColorAnalysis[]
): ColorMapping[] {
  const dynamicColors = analysis.filter((a) => a.type === "dynamic");
  const mappings: ColorMapping[] = [];

  for (const dc of dynamicColors) {
    // Skip if this IS a primary color
    if (primaryColorNames.includes(dc.name)) continue;

    const deltas: { primaryIndex: number; delta: HSLDelta }[] = [];

    for (const theme of themes) {
      const targetColor = theme.colors.find((c) => c.name === dc.name);
      if (!targetColor) continue;

      // Get the primary colors from this theme
      const themePrimaries = primaryColorNames.map((pn) =>
        theme.colors.find((c) => c.name === pn)
      );

      const validPrimaries = themePrimaries.filter(
        (p): p is ThemeColor => p !== undefined
      );
      if (validPrimaries.length === 0) continue;

      const nearestIdx = findNearestPrimary(
        targetColor.value,
        validPrimaries.map((p) => p.value)
      );
      const delta = getHSLDelta(
        validPrimaries[nearestIdx].value,
        targetColor.value
      );

      deltas.push({ primaryIndex: nearestIdx, delta });
    }

    if (deltas.length === 0) continue;

    // Use the most common primary index
    const indexCounts = new Map<number, number>();
    for (const d of deltas) {
      indexCounts.set(d.primaryIndex, (indexCounts.get(d.primaryIndex) || 0) + 1);
    }
    let bestIndex = 0;
    let bestCount = 0;
    for (const [idx, count] of indexCounts) {
      if (count > bestCount) {
        bestIndex = idx;
        bestCount = count;
      }
    }

    const relevantDeltas = deltas
      .filter((d) => d.primaryIndex === bestIndex)
      .map((d) => d.delta);

    mappings.push({
      colorName: dc.name,
      primaryIndex: bestIndex,
      averageDelta: averageDeltas(relevantDeltas),
    });
  }

  return mappings;
}

export function generateTheme(
  themeName: string,
  newPrimaries: { name: string; value: ColorValue }[],
  mappings: ColorMapping[],
  staticColors: ColorAnalysis[],
  existingThemeForStatics: Theme
): Theme {
  const now = new Date().toISOString();
  const colors: ThemeColor[] = [];

  // Add static colors from the reference theme
  for (const sc of staticColors) {
    const refColor = existingThemeForStatics.colors.find(
      (c) => c.name === sc.name
    );
    if (refColor) {
      colors.push({ ...refColor });
    }
  }

  // Add the primary colors directly
  for (const primary of newPrimaries) {
    const group = primary.name.split("/")[0] || undefined;
    colors.push({
      name: primary.name,
      value: primary.value,
      group,
    });
  }

  // Generate dynamic colors from mappings
  for (const mapping of mappings) {
    const primaryValue = newPrimaries[mapping.primaryIndex]?.value;
    if (!primaryValue) continue;

    const generated = applyHSLDelta(primaryValue, mapping.averageDelta);
    const group = mapping.colorName.split("/")[0] || undefined;

    colors.push({
      name: mapping.colorName,
      value: generated,
      group,
    });
  }

  return {
    id: `generated-${Date.now()}`,
    name: themeName,
    colors,
    createdAt: now,
    updatedAt: now,
  };
}
