// https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel
import {
  AbstractChannelProtocol,
  IMessageChannel,
  AbstractChannelProtocolProps,
  SenderMiddleware,
  ClientMiddleware,
} from '@x-oasis/async-call-rpc';

/**
 * RPC channel protocol for the Web `MessagePort` API.
 *
 * Wraps a `MessagePort` (from `new MessageChannel()`) for bidirectional
 * RPC communication between browsing contexts — iframes, windows,
 * or a renderer ↔ worker.
 *
 * @example
 * ```ts
 * const { port1, port2 } = new MessageChannel();
 *
 * const channelA = new RPCMessageChannel({ port: port1 });
 * const channelB = new RPCMessageChannel({ port: port2 });
 * ```
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel
 */
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

  /**
   * 发送消息通过 MessagePort
   *
   * 注意：MessagePort.postMessage() 的签名是 (message, transferList)
   * 不同于 Window.postMessage() 的签名 (message, targetOrigin)
   *
   * 虽然构造函数中定义了 targetOrigin 参数，但在 MessagePort 的场景下不需要使用：
   * - MessagePort 是通过 MessageChannel 创建的成对端口，通信双方身份已确定
   * - 消息只能在持有对应 port 引用的对象之间传递，天然是安全的点对点通道
   * - targetOrigin 在此场景下不适用，因为 MessagePort API 本身不支持该参数
   *
   * targetOrigin 字段的保留是为了 API 的灵活性和未来的兼容性扩展
   */
  send(message: any, transfer?: Transferable[]) {
    if (transfer && transfer.length > 0) {
      this.port.postMessage(message, transfer);
    } else {
      this.port.postMessage(message);
    }
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
