import {
  AbstractChannelProtocol,
  IMessageChannel,
  AbstractChannelProtocolProps,
  SenderMiddleware,
  ClientMiddleware,
} from '@x-oasis/async-call-rpc/core';

export default class RPCMessageChannel
  extends AbstractChannelProtocol
  implements IMessageChannel
{
  private port: MessagePort | null;
  private sender: any;
  private targetOrigin: string;
  private _detachListener: (() => void) | null;
  private _onMessageListener: ((event: MessageEvent) => void) | null;

  constructor(
    options: {
      port?: MessagePort;
      sender?: any;
      targetOrigin?: string;
    } & AbstractChannelProtocolProps = {}
  ) {
    super(
      options.port
        ? (options as AbstractChannelProtocolProps)
        : { ...(options as AbstractChannelProtocolProps), connected: false }
    );
    this.port = null;
    this._detachListener = null;
    this._onMessageListener = null;
    this.targetOrigin = options.targetOrigin || '*';
    this.sender =
      options.sender !== undefined
        ? options.sender
        : typeof window !== 'undefined'
        ? window
        : undefined;
    if (options.port) this._attachPort(options.port);
  }

  bindPort(port: MessagePort, options?: { rebind?: boolean }): void {
    if (this.port) {
      if (options?.rebind) {
        this._detachPort();
      } else {
        return;
      }
    }
    this._attachPort(port);
    this.activate();
  }

  on(listener: (event: MessageEvent) => void): void | (() => void) {
    this._onMessageListener = listener;
    if (!this.port) {
      return () => {
        if (this._onMessageListener === listener)
          this._onMessageListener = null;
        if (this._detachListener) {
          this._detachListener();
          this._detachListener = null;
        }
      };
    }
    this._detachListener = this._wireListener(this.port, listener);
    return () => {
      if (this._detachListener) {
        this._detachListener();
        this._detachListener = null;
      }
      if (this._onMessageListener === listener) this._onMessageListener = null;
    };
  }

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
    this._detachPort();
    super.disconnect();
  }

  private _detachPort(): void {
    if (!this.port) return;
    if (this._detachListener) {
      this._detachListener();
      this._detachListener = null;
    }
    try {
      this.port.close();
    } catch {}
    this.port = null;
    this._isConnected = false;
  }

  private _attachPort(port: MessagePort): void {
    this.port = port;
    if (port.start) port.start();
    if (this._onMessageListener) {
      this._detachListener = this._wireListener(port, this._onMessageListener);
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
