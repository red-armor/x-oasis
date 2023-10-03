export type RecyclerProps = {
  recyclerTypes?: Array<string>;
  recyclerBufferSize?: number;
  thresholdIndexValue?: number;
  recyclerReservedBufferPerBatch?: number;
  metaExtractor?: (index: number) => any;
  indexExtractor?: (meta: any) => number;
  getType?: (index: number) => string;
};

export type SafeRange = {
  startIndex: number;
  endIndex: number;
};

export type FixedBufferProps = {
  /**
   * index which start to replace
   */
  thresholdIndexValue?: number;
  /**
   * max size
   */
  bufferSize?: number;

  recyclerType?: string;

  metaExtractor?: (index: number) => any;
  indexExtractor?: (meta: any) => number;
};

export type ItemMeta = any;

export type FixedBufferStateItem = {
  targetIndex: number;
  recyclerKey: string;
  itemMeta: any;
};

export type FixedBufferState = Array<FixedBufferStateItem>;

export type OnProcess = (type?: string, index?: number) => boolean;
