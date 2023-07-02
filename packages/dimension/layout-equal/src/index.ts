import { ItemLayout } from './types';

const KEY_TO_CHECK = ['x', 'y', 'height', 'width'];

export default function layoutEqual(
  oldLayout: ItemLayout,
  newLayout: ItemLayout,
  options?: {
    keysToCheck?: Array<'x' | 'y' | 'height' | 'width'>;
    correctionValue?: number;
  }
) {
  const oldLayoutType = Object.prototype.toString.call(oldLayout);
  const newLayoutType = Object.prototype.toString.call(newLayout);
  const keysToCheck = options?.keysToCheck || KEY_TO_CHECK;
  const correctionValue = options?.correctionValue || 0;

  if (oldLayoutType === newLayoutType && newLayoutType === '[object Object]') {
    for (let index = 0; index < keysToCheck.length; index++) {
      const key = keysToCheck[index];
      if (Math.abs(oldLayout[key] - newLayout[key]) > correctionValue) {
        return false;
      }
    }

    return true;
  }

  return false;
}
