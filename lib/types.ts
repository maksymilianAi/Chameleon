export interface ColorValue {
  hex: string;
  r: number; // 0-1
  g: number; // 0-1
  b: number; // 0-1
  a: number; // 0-1
}

export interface ThemeColor {
  name: string;
  value: ColorValue;
  group?: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColor[];
  createdAt: string;
  updatedAt: string;
}

export interface ColorAnalysis {
  name: string;
  type: "static" | "dynamic";
  variance: number;
  values: { themeId: string; value: ColorValue }[];
}

export interface PluginState {
  themes: Theme[];
  analysis: ColorAnalysis[];
  dynamicColorThreshold: number;
}

export interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

export interface HSLDelta {
  dh: number;
  ds: number;
  dl: number;
}

// Messages between UI and plugin code
export type PluginMessage =
  | { type: "IMPORT_FROM_FIGMA" }
  | { type: "APPLY_THEME"; theme: Theme; modeId: string }
  | { type: "SAVE_STATE"; state: PluginState }
  | { type: "LOAD_STATE" }
  | { type: "EXPORT_JSON" }
  | { type: "IMPORT_JSON"; json: string }
  | { type: "GET_MODES" }
  | { type: "GET_COLLECTIONS" }
  | { type: "CREATE_MODE_AND_APPLY"; theme: Theme; collectionId: string };

export type UIMessage =
  | { type: "THEMES_IMPORTED"; themes: Theme[] }
  | { type: "THEME_APPLIED"; success: boolean; error?: string }
  | { type: "STATE_LOADED"; state: PluginState | null }
  | { type: "STATE_SAVED" }
  | { type: "JSON_EXPORTED"; json: string }
  | { type: "JSON_IMPORTED"; state: PluginState }
  | { type: "MODES_LIST"; modes: { id: string; name: string; collectionId: string; collectionName: string }[] }
  | { type: "COLLECTIONS_LIST"; collections: { id: string; name: string }[] }
  | { type: "MODE_CREATED"; success: boolean; modeName: string; applied: number; skipped: number; error?: string }
  | { type: "ERROR"; message: string };
