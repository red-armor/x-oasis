import { ItemLayout } from "./types";

export default function layoutEqual(oldLayout: ItemLayout, newLayout: ItemLayout) {
  const oldLayoutType = Object.prototype.toString.call(oldLayout);
  const newLayoutType = Object.prototype.toString.call(newLayout);

  if (oldLayoutType === newLayoutType && newLayoutType === '[object Object]') {
    const keys = ['x', 'y', 'height', 'width'];
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      if (oldLayout[key] !== newLayout[key]) {
        return false;
      }
    }

    return true;
  }

  return false;
}