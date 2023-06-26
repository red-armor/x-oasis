import { ItemLayout } from './types';

const KEY_TO_CHECK = ['x', 'y', 'height', 'width'];

export default function layoutEqual(
  oldLayout: ItemLayout,
  newLayout: ItemLayout,
  // @ts-ignore
  keysToCheck: Array<'x' | 'y' | 'height' | 'width'> = KEY_TO_CHECK
) {
  const oldLayoutType = Object.prototype.toString.call(oldLayout);
  const newLayoutType = Object.prototype.toString.call(newLayout);

  if (oldLayoutType === newLayoutType && newLayoutType === '[object Object]') {
    for (let index = 0; index < keysToCheck.length; index++) {
      const key = keysToCheck[index];
      if (oldLayout[key] !== newLayout[key]) {
        return false;
      }
    }

    return true;
  }

  return false;
}
