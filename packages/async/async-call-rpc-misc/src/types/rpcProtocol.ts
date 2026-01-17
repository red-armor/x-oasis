export type IRPCProtocolServer = {
  source: any;
  encoder: null;
  decoder: null;
  onRequest: () => {};
  handleRequest: () => {};
  sendReply: () => {};
};

export type IRPCProtocolClient = {
  source: any;
  encode: () => {};
  decode: () => {};
  sendRequest: () => {};
  onReply: () => {};
  handleReply: () => {};
};

export type IRPCProtocol = {
  encode: Function;
  decode: Function;
  onMessage: Function;
  send: Function;
};
