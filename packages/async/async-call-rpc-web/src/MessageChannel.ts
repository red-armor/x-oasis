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
 * ## Late port binding
 *
 * The `port` may be supplied at construction time, or attached later via
 * {@link bindPort}. The "construct now, bind later" pattern is useful
 * when the port arrives on a `MessageEvent` transfer after a service
 * has already been registered. While unbound, the channel is in the
 * disconnected state — sends queue and flush on {@link bindPort}.
 *
 * @example
 * ```ts
 * const { port1, port2 } = new MessageChannel();
 *
 * const channelA = new RPCMessageChannel({ port: port1 });
 * const channelB = new RPCMessageChannel({ port: port2 });
 *
 * // Or: bind later
 * const pending = new RPCMessageChannel({});
 * pending.setServiceHost(host);
 * window.addEventListener('message', (e) => {
 *   if (e.data === 'port') pending.bindPort(e.ports[0]);
 * });
 * ```
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel
 */
export default class RPCMessageChannel
  extends AbstractChannelProtocol
  implements IMessageChannel
{
  private port: MessagePort | null;
  private sender: any;
  private targetOrigin: string;
  private _detachListener: (() => void) | null;
  private _pendingListener: ((event: MessageEvent) => void) | null;

  constructor(
    options: {
      port?: MessagePort;
      sender?: any;
      targetOrigin?: string;
    } & AbstractChannelProtocolProps = {}
  ) {
    // No port → start disconnected so sends queue.
    super(
      options.port
        ? (options as AbstractChannelProtocolProps)
        : { ...(options as AbstractChannelProtocolProps), connected: false }
    );
    this.port = null;
    this._detachListener = null;
    this._pendingListener = null;
    this.targetOrigin = options.targetOrigin || '*';
    this.sender =
      options.sender !== undefined
        ? options.sender
        : typeof window !== 'undefined'
        ? window
        : undefined;
    if (options.port) this._attachPort(options.port);
  }

  /**
   * Attach a `MessagePort` to a previously-unbound channel and activate
   * it. Queued sends will flush via the framework's `resumePendingEntry`
   * on the `onDidConnected` event.
   *
   * No-op if a port is already bound.
   */
  bindPort(port: MessagePort): void {
    if (this.port) return;
    this._attachPort(port);
    this.activate();
  }

  on(listener: (event: MessageEvent) => void): void | (() => void) {
    if (!this.port) {
      this._pendingListener = listener;
      return () => {
        if (this._pendingListener === listener) this._pendingListener = null;
        if (this._detachListener) {
          this._detachListener();
          this._detachListener = null;
        }
      };
    }
    return this._wireListener(this.port, listener);
  }

  /**
   * Send a message through the underlying `MessagePort`.
   *
   * Note: `MessagePort.postMessage(message, transferList)` differs from
   * `Window.postMessage(message, targetOrigin)`. `targetOrigin` is kept
   * on the constructor for API flexibility but is unused for ports —
   * a `MessagePort` is already a point-to-point channel.
   */
  send(message: any, transfer?: Transferable[]) {
    if (!this.port) {
      console.warn('[RPCMessageChannel] send called before port was bound.');
      return;
    }
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
    super.disconnect();
  }

  private _attachPort(port: MessagePort): void {
    this.port = port;
    if (port.start) port.start();
    if (this._pendingListener) {
      this._detachListener = this._wireListener(port, this._pendingListener);
      this._pendingListener = null;
    }
  }

  private _wireListener(
    port: MessagePort,
    listener: (event: MessageEvent) => void
  ): () => void {
    const f = (ev: MessageEvent): void => {
      listener(ev);
    };
    port.addEventListener('message', f);
    return () => port.removeEventListener('message', f);
  }
}
