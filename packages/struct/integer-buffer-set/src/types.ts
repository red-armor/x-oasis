// export type ValueToPositionObject = {
//   [key: string]: number;
// };

// export type ValueToMetaObject<T> = {
//   [key: string]: T;
// };

export type MetaToIndexMap<T> = Map<T, number>;
export type MetaToPositionMap<T> = Map<T, number>;
export type IndexToMetaMap<T> = Map<number, T>;

export type MetaExtractor<T> = (index: number) => T;
export type IndexExtractor<T> = (meta: T) => number;
export type IntegerBufferSetProps<T> = {
  type?: string;
  bufferSize?: number;
  metaExtractor?: MetaExtractor<T>;
  indexExtractor?: IndexExtractor<T>;
};

export type HeapItem = {
  position: number;
  value: number;
};

export type SafeRange = {
  startIndex: number;
  endIndex: number;
};

export type BufferResultToken = {
  meta: any;
  targetIndex: number;
  recyclerKey: string;
};

export type BufferIndicesItem<T = any> = {
  meta: T;
  targetIndex: number;
  recyclerKey: string;
};
