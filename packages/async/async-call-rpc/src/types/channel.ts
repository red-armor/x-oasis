export type IMessageChannelOnClose = () => void;
export type IMessageChannelOnError = () => void;
export type IMessageChannelOnMessage = (message: any) => void;
export type IMessageChannelSend = (options: any) => void;
export type IMessageChannelDisconnect = () => void;

/**
 * A channel is a bidirectional communications channel
 */
export type IMessageChannel = {
  onClose?: IMessageChannelOnClose;

  onError?: IMessageChannelOnError;

  onMessage: IMessageChannelOnMessage;

  send: IMessageChannelSend;

  disconnect: IMessageChannelDisconnect;
};

export type SendingProps = {
  requestPath: string;
  methodName: string;
  args?: any[];
  isOptionsRequest?: boolean;
  transfer?: MessagePort[];
};
