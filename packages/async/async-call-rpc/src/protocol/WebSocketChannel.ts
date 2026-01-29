import AbstractChannelProtocol from './AbstractChannelProtocol';
import {
  SenderMiddleware,
  ClientMiddleware,
  AbstractChannelProtocolProps,
} from '../types';
import { normalizeWebSocketRawMessage } from '../middlewares/normalize';

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
    // super() must be the first statement - extract options inline using IIFE
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

    // Now we can assign to instance properties
    this.socket = socket;
    this.name = name || 'websocket';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = maxReconnectAttempts ?? 5;
    this.reconnectDelay = reconnectDelay ?? 1000;

    // Set up WebSocket event handlers
    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.socket.addEventListener('open', () => {
      // WebSocket 已打开，激活连接
      this.activate();
    });

    this.socket.addEventListener('close', () => {
      // WebSocket 已关闭，断开连接
      super.disconnect();
    });

    this.socket.addEventListener('error', (error) => {
      console.error(`[WebSocketChannel ${this.name}] Error:`, error);
    });
  }

  on(listener: (data: unknown) => void): void | (() => void) {
    // Handle both browser MessageEvent and Node.js ws library format
    const f = (ev: MessageEvent | Buffer | string | any): void => {
      // Debug: log the event structure
      if (ev === undefined || ev === null) {
        console.warn(
          `[WebSocketChannel ${this.name}] Received undefined/null message event`
        );
        return;
      }

      // Pass the raw event/data to listener
      // The normalizeWebSocketRawMessage middleware will handle the conversion
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
      // Type assertion for Node.js ws library
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

    // If neither method works, return a no-op cleanup function
    return () => {};
  }

  send(data: unknown): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      // Data should already be serialized (string) by the middleware
      // WebSocket.send() accepts string, ArrayBuffer, or Blob
      if (typeof data === 'string') {
        this.socket.send(data);
      } else if (data instanceof ArrayBuffer || data instanceof Blob) {
        this.socket.send(data);
      } else {
        // Fallback: serialize if not already serialized
        this.socket.send(JSON.stringify(data));
      }
    } else {
      console.warn(
        `[WebSocketChannel ${this.name}] Cannot send: WebSocket is not open. State: ${this.socket.readyState}`
      );
    }
  }

  /**
   * Inherits buffer getters from AbstractChannelProtocol
   * Uses BufferFactory with configured serialization format
   *
   * To use a different format, pass serializationFormat in constructor:
   * new WebSocketChannel(socket, { serializationFormat: 'msgpack' })
   *
   * Or override these getters if you need custom buffer logic
   */

  decorateSendMiddleware(middlewares: SenderMiddleware[]) {
    return middlewares;
  }

  decorateOnMessageMiddleware(middlewares: ClientMiddleware[]) {
    // Replace the first middleware (normalizeMessageChannelRawMessage)
    // with normalizeWebSocketRawMessage to handle both browser and Node.js ws library formats
    // Note: We return the factory function, not the result of calling it
    // because applyOnMessageMiddleware will call fn(this) for each middleware
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

  /**
   * Get the current WebSocket ready state
   */
  get readyState(): number {
    return this.socket.readyState;
  }

  /**
   * Check if WebSocket is open
   */
  isOpen(): boolean {
    return this.socket.readyState === WebSocket.OPEN;
  }
}
