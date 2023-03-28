import { normalizeColor } from './normalizeColor';

export function isRgbOrRgba(range) {
  return typeof range === 'string' && range.startsWith('rgb');
}

export function colorToRgba(input: string): string {
  let int32Color = normalizeColor(input);
  if (int32Color === null) {
    return input;
  }

  int32Color = int32Color || 0;

  const r = (int32Color & 0xff000000) >>> 24;
  const g = (int32Color & 0x00ff0000) >>> 16;
  const b = (int32Color & 0x0000ff00) >>> 8;
  const a = (int32Color & 0x000000ff) / 255;

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function Rgb(r, g, b, opacity) {
  this.r = +r;
  this.g = +g;
  this.b = +b;
  this.opacity = opacity;
}

// https://github.com/d3/d3-color/blob/main/src/color.js#L229
export function rgbConvert(color: string) {
  const rgb = isRgbOrRgba(color) ? color : colorToRgba(color);
  const regexp = /rgb[a]\(([0-9.]*)\D*([0-9.]*)\D*([0-9.]*)\D*([0-9.]*)\)/;

  const matched = rgb.match(regexp);

  const r = matched[1];
  const g = matched[2];
  const b = matched[3];
  const a = typeof matched[4] === 'undefined' ? '1' : matched[4];

  return {
    r: parseFloat(r),
    g: parseFloat(g),
    b: parseFloat(b),
    a: parseFloat(a),
  };
}

export function rgbString(r, g, b) {
  return `rgba(${r}, ${g}, ${b})`;
}

export function rgbaString(r, g, b, a) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
