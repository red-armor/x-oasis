export default function isClamped(min: number, value: number, max: number) {
  if (value >= min && value <= max) return true;
  return false;
}
