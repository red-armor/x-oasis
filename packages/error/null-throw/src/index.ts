// https://github.com/zertosh/nullthrows
// https://github.com/expo/nullthrows/blob/main/src/nullthrows.ts

export default function <T>(x: T): T {
  if (x != null) {
    return x;
  }
  throw new Error('Got unexpected null or undefined');
}
