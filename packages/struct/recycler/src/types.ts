export type RecyclerProps = {
  recyclerTypes?: Array<string>;
  recyclerBufferSize?: number;
  thresholdIndexValue?: number;
  recyclerReservedBufferPerBatch?: number;
  metaExtractor?: (index: number) => ItemMeta;
  indexExtractor?: (meta: any) => number;
  getType?: (index: number) => string;
};

export type SafeRange = {
  startIndex: number;
  endIndex: number;
};

export type ItemMeta = any;

export type OnRecyclerProcess = (type?: string, index?: number) => boolean;
