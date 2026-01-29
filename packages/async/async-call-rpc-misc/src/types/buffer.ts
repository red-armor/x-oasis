export type DataBuffer = {
  // refer to theia/packages/core/src/common/messaging/socket-write-buffer.ts
  flush: () => void;
  drain: () => void;
};
