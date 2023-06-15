import isObject from '@x-oasis/is-object';

type EachArray<T> = (index: number, entry: any, obj: T) => void;
type EachObject<T> = <K extends keyof T>(key: K, entry: T[K], obj: T) => number;
type Iter<T extends Array<any> | { [key: string]: any }> = T extends Array<any>
  ? EachArray<T>
  : T extends { [key: string]: any }
  ? EachObject<T>
  : never;

export function each<T>(obj: T, iter: Iter<T>) {
  if (Array.isArray(obj)) {
    (obj as Array<any>).forEach((entry, index) =>
      (iter as EachArray<T>)(index, entry, obj)
    );
  } else if (isObject(obj)) {
    // @ts-ignore
    ownKeys(obj).forEach((key) => (iter as EachObject<T>)(key, obj[key], obj));
  }
}
