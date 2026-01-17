import { CharCode } from './CharCode';

export function isAsciiDigit(code: number): boolean {
  return code >= CharCode.Digit0 && code <= CharCode.Digit9;
}

export function isLowerAsciiLetter(code: number): boolean {
  return code >= CharCode.a && code <= CharCode.z;
}

export function isUpperAsciiLetter(code: number): boolean {
  return code >= CharCode.A && code <= CharCode.Z;
}
