// https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel
import { IMessageChannel } from '../types/channel';
import AbstractChannelProtocol from './AbstractChannelProtocol';
import ReadBuffer from '../buffer/ReadBuffer';
import WriteBuffer from '../buffer/WriteBuffer';
import { SenderMiddleware, ClientMiddleware } from '../types';

export default class RPCMessageChannel
  extends AbstractChannelProtocol
  implements IMessageChannel
{
  private readonly port: MessagePort;
  private sender: any;
  private targetOrigin: string;

  constructor(options: {
    port: MessagePort;
    sender: any;
    targetOrigin?: string;
  }) {
    super();
    const { port, sender = window, targetOrigin = '*' } = options;
    this.port = port;
    this.targetOrigin = targetOrigin;
    this.sender = sender;
  }

  on(listener: (event: MessageEvent) => void) {
    this.port.onmessage = listener;
  }

  send(message: any) {
    this.sender.postMessage(message, this.targetOrigin, [this.port]);
  }

  /**
   * 可以通过重写这个方法，来使用不同的读取buffer
   */
  get readBuffer() {
    return new ReadBuffer();
  }

  get writeBuffer() {
    return new WriteBuffer();
  }

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
