// https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel
import {
  IMessageChannel,
  AbstractChannelProtocolProps,
} from '../types/channel';
import AbstractChannelProtocol from './AbstractChannelProtocol';
import { SenderMiddleware, ClientMiddleware } from '../types';

export default class RPCMessageChannel
  extends AbstractChannelProtocol
  implements IMessageChannel
{
  private readonly port: MessagePort;
  private sender: any;
  private targetOrigin: string;

  constructor(
    options: {
      port: MessagePort;
      sender?: any;
      targetOrigin?: string;
    } & AbstractChannelProtocolProps
  ) {
    // Extract channel-specific options and pass the rest to parent
    const {
      port,
      sender = window,
      targetOrigin = '*',
      ...protocolOptions
    } = options;
    super(protocolOptions);
    this.port = port;
    this.targetOrigin = targetOrigin;
    this.sender = sender;
    // MessagePort 需要调用 start() 才能开始接收消息（当使用 addEventListener 时）
    if (this.port.start) {
      this.port.start();
    }
  }

  on(listener: (event: MessageEvent) => void): void | (() => void) {
    const f = (ev: MessageEvent): void => {
      listener(ev);
    };
    this.port.addEventListener('message', f);
    return () => this.port.removeEventListener('message', f);
  }

  send(message: any, transfer?: Transferable[]) {
    if (transfer && transfer.length > 0) {
      this.port.postMessage(message, transfer);
    } else {
      this.port.postMessage(message);
    }
  }

  /**
   * Inherits buffer getters from AbstractChannelProtocol
   * Uses BufferFactory with configured serialization format
   *
   * To use a different format, pass serializationFormat in constructor:
   * new RPCMessageChannel({ port, serializationFormat: 'msgpack' })
   *
   * Or override these getters if you need custom buffer logic
   */

  decorateSendMiddleware(middlewares: SenderMiddleware[]) {
    return middlewares;
  }

  decorateOnMessageMiddleware(middlewares: ClientMiddleware[]) {
    return middlewares;
  }

  disconnect() {
    if (this.port) {
      this.port.close();
    }
  }
}
