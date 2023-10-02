export type RecyclerProps = {
  recyclerTypes?: Array<string>;
  recyclerBufferSize?: number;
  thresholdIndexValue?: number;
  recyclerReservedBufferPerBatch?: number;
  // owner: any;
  metaExtractor?: (index: number) => any;
  indexExtractor?: (meta: any) => number;
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

  recyclerReservedBufferSize?: number;

  recyclerType?: string;

  startIndex?: number;
  // owner?: any;

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
