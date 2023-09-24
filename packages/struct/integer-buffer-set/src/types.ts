export type ValueToPositionObject = {
  [key: string]: number;
};

export type ValueToMetaObject<T> = {
  [key: string]: T;
};

export type MetaToValueMap<T> = Map<T, number>;

export type MetaExtractor = (value: number) => any;
export type IntegerBufferSetProps = {
  bufferSize?: number;
  metaExtractor?: MetaExtractor;
};

export type HeapItem = {
  position: number;
  value: number;
};
