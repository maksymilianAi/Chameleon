import { ColorValue, HSL, HSLDelta } from "../types";

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.substring(0, 2), 16) / 255,
    g: parseInt(clean.substring(2, 4), 16) / 255,
    b: parseInt(clean.substring(4, 6), 16) / 255,
  };
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  h /= 360;
  s /= 100;
  l /= 100;

  if (s === 0) {
    return { r: l, g: l, b: l };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: hue2rgb(p, q, h + 1 / 3),
    g: hue2rgb(p, q, h),
    b: hue2rgb(p, q, h - 1 / 3),
  };
}

export function colorValueToHsl(color: ColorValue): HSL {
  return rgbToHsl(color.r, color.g, color.b);
}

export function hslToColorValue(hsl: HSL, a: number = 1): ColorValue {
  const { r, g, b } = hslToRgb(hsl.h, hsl.s, hsl.l);
  return { r, g, b, a, hex: rgbToHex(r, g, b) };
}

export function makeColorValue(r: number, g: number, b: number, a: number = 1): ColorValue {
  return { r, g, b, a, hex: rgbToHex(r, g, b) };
}

export function hexToColorValue(hex: string, a: number = 1): ColorValue {
  const { r, g, b } = hexToRgb(hex);
  return { r, g, b, a, hex: hex.toUpperCase() };
}

export function colorDistance(a: ColorValue, b: ColorValue): number {
  const hslA = colorValueToHsl(a);
  const hslB = colorValueToHsl(b);

  // Weighted perceptual distance in HSL space
  const dh = Math.min(Math.abs(hslA.h - hslB.h), 360 - Math.abs(hslA.h - hslB.h)) / 180;
  const ds = Math.abs(hslA.s - hslB.s) / 100;
  const dl = Math.abs(hslA.l - hslB.l) / 100;

  return Math.sqrt(dh * dh + ds * ds + dl * dl);
}

export function getHSLDelta(base: ColorValue, target: ColorValue): HSLDelta {
  const baseHSL = colorValueToHsl(base);
  const targetHSL = colorValueToHsl(target);

  let dh = targetHSL.h - baseHSL.h;
  // Normalize hue delta to [-180, 180]
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;

  return {
    dh,
    ds: targetHSL.s - baseHSL.s,
    dl: targetHSL.l - baseHSL.l,
  };
}

export function applyHSLDelta(color: ColorValue, delta: HSLDelta): ColorValue {
  const hsl = colorValueToHsl(color);

  let h = (hsl.h + delta.dh) % 360;
  if (h < 0) h += 360;
  const s = Math.max(0, Math.min(100, hsl.s + delta.ds));
  const l = Math.max(0, Math.min(100, hsl.l + delta.dl));

  return hslToColorValue({ h, s, l }, color.a);
}

export function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}
