import {
  AbstractChannelProtocol,
  AbstractChannelProtocolProps,
  SenderMiddleware,
  ClientMiddleware,
  normalizeWebSocketRawMessage,
} from '@x-oasis/async-call-rpc/core';

/**
 * RPC channel protocol for WebSocket connections.
 *
 * Works in both browser (native WebSocket) and Node.js (`ws` library).
 * Handles automatic reconnection, binary/text frame normalization,
 * and cross-platform event listener differences.
 *
 * @example
 * ```ts
 * // Browser
 * const ws = new WebSocket('ws://localhost:8080');
 * const channel = new WebSocketChannel(ws, { name: 'my-ws' });
 * ```
 *
 * @example
 * ```ts
 * // Node.js (ws library)
 * import WebSocket from 'ws';
 * const ws = new WebSocket('ws://localhost:8080');
 * const channel = new WebSocketChannel(ws as any, { name: 'node-ws' });
 * ```
 */
export default class WebSocketChannel extends AbstractChannelProtocol {
  private socket: WebSocket;
  readonly name: string;
  private reconnectAttempts: number;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;

  /**
   * @param socket Pass the WebSocket instance (client-side) or WebSocket connection (server-side).
   * @param options Configuration options
   */
  constructor(
    socket: WebSocket,
    options?: {
      name?: string;
      maxReconnectAttempts?: number;
      reconnectDelay?: number;
      connected?: boolean;
    } & AbstractChannelProtocolProps
  ) {
    const opts = options || {};
    const {
      name,
      maxReconnectAttempts,
      reconnectDelay,
      connected,
      ...protocolOptions
    } = opts;

    super({
      connected: connected ?? false,
      ...protocolOptions,
    });

    this.socket = socket;
    this.name = name || 'websocket';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = maxReconnectAttempts ?? 5;
    this.reconnectDelay = reconnectDelay ?? 1000;

    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.socket.addEventListener('open', () => {
      this.activate();
    });

    this.socket.addEventListener('close', () => {
      super.disconnect();
    });

    this.socket.addEventListener('error', (error) => {
      console.error(`[WebSocketChannel ${this.name}] Error:`, error);
    });
  }

  on(listener: (data: unknown) => void): void | (() => void) {
    const f = (ev: MessageEvent | Buffer | string | any): void => {
      if (ev === undefined || ev === null) {
        console.warn(
          `[WebSocketChannel ${this.name}] Received undefined/null message event`
        );
        return;
      }
      listener(ev);
    };

    // Try addEventListener first (works in both browser and ws library)
    if (typeof this.socket.addEventListener === 'function') {
      this.socket.addEventListener('message', f);
      return () => {
        if (typeof this.socket.removeEventListener === 'function') {
          this.socket.removeEventListener('message', f);
        }
      };
    } else {
      // Fallback to 'on' method for older ws library versions
      const wsSocket = this.socket as any;
      if (typeof wsSocket.on === 'function') {
        wsSocket.on('message', f);
        return () => {
          if (typeof wsSocket.off === 'function') {
            wsSocket.off('message', f);
          } else if (typeof wsSocket.removeListener === 'function') {
            wsSocket.removeListener('message', f);
          }
        };
      }
    }

    return () => {};
  }

  send(data: unknown): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      if (typeof data === 'string') {
        this.socket.send(data);
      } else if (data instanceof ArrayBuffer || data instanceof Blob) {
        this.socket.send(data);
      } else {
        this.socket.send(JSON.stringify(data));
      }
    } else {
      console.warn(
        `[WebSocketChannel ${this.name}] Cannot send: WebSocket is not open. State: ${this.socket.readyState}`
      );
    }
  }

  decorateSendMiddleware(middlewares: SenderMiddleware[]) {
    return middlewares;
  }

  decorateOnMessageMiddleware(middlewares: ClientMiddleware[]) {
    if (middlewares.length > 0) {
      return [normalizeWebSocketRawMessage, ...middlewares.slice(1)];
    }
    return middlewares;
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
    }
    super.disconnect();
  }

  get readyState(): number {
    return this.socket.readyState;
  }

  isOpen(): boolean {
    return this.socket.readyState === WebSocket.OPEN;
  }
}
