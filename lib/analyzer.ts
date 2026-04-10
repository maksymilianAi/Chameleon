import { Theme, ColorAnalysis } from "../types";
import { colorValueToHsl } from "./color-utils";

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sqDiffs = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function hueStdDev(hues: number[]): number {
  if (hues.length < 2) return 0;

  // Circular standard deviation for hue (0-360 wraps around)
  const radians = hues.map((h) => (h * Math.PI) / 180);
  const sinMean = radians.reduce((a, r) => a + Math.sin(r), 0) / radians.length;
  const cosMean = radians.reduce((a, r) => a + Math.cos(r), 0) / radians.length;
  const R = Math.sqrt(sinMean ** 2 + cosMean ** 2);

  // Convert to linear standard deviation approximation (0-1 range)
  return Math.sqrt(-2 * Math.log(Math.max(R, 0.0001))) / Math.PI;
}

export function analyzeThemes(
  themes: Theme[],
  threshold: number
): ColorAnalysis[] {
  if (themes.length < 2) return [];

  // Collect all unique color names
  const colorNames = new Set<string>();
  for (const theme of themes) {
    for (const color of theme.colors) {
      colorNames.add(color.name);
    }
  }

  const results: ColorAnalysis[] = [];

  for (const name of colorNames) {
    const values: ColorAnalysis["values"] = [];
    const hues: number[] = [];
    const sats: number[] = [];
    const lights: number[] = [];

    for (const theme of themes) {
      const color = theme.colors.find((c) => c.name === name);
      if (!color) continue;

      values.push({ themeId: theme.id, value: color.value });
      const hsl = colorValueToHsl(color.value);
      hues.push(hsl.h);
      sats.push(hsl.s);
      lights.push(hsl.l);
    }

    if (values.length < 2) {
      results.push({ name, type: "static", variance: 0, values });
      continue;
    }

    // Combined variance from H, S, L channels
    const hVar = hueStdDev(hues);
    const sVar = standardDeviation(sats) / 100;
    const lVar = standardDeviation(lights) / 100;
    const variance = Math.sqrt(hVar ** 2 + sVar ** 2 + lVar ** 2);

    results.push({
      name,
      type: variance > threshold ? "dynamic" : "static",
      variance,
      values,
    });
  }

  return results.sort((a, b) => b.variance - a.variance);
}
