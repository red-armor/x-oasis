import { rgbConvert, rgbaString } from './rgb';

// https://github.com/d3/d3-interpolate#interpolateRgb
// https://github.com/d3/d3-interpolate/blob/main/src/rgb.js
export function interpolateRgb(a: string, b: string) {
  const rgbb = rgbConvert(b);
  const rgba = rgbConvert(a);

  return (number: number) => {
    const n = Math.max(Math.min(1, number), 0);
    const r = rgba.r + (rgbb.r - rgba.r) * n;
    const g = rgba.g + (rgbb.g - rgba.g) * n;
    const b = rgba.b + (rgbb.b - rgba.b) * n;
    const a = rgba.a + (rgbb.a - rgba.a) * n;

    return rgbaString(r, g, b, a);
  };
}
