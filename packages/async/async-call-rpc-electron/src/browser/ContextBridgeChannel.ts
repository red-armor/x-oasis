import {
  AbstractChannelProtocol,
  processClientRawMessage,
  normalizeMessageChannelRawMessage,
  ClientMiddleware,
} from '@x-oasis/async-call-rpc';

import { ContextBridgeAPI, ContextBridgeChannelProps } from '../types';

const BRIDGE_KEY = '__rpc_bridge__' as const;

export default class ContextBridgeChannel extends AbstractChannelProtocol {
  private _bridge: ContextBridgeAPI | null = null;
  private _listeners = new Set<(data: unknown) => void>();
  private _cleanupBridgeListener: (() => void) | null = null;
  private _bridgeKey: string;

  constructor(props?: ContextBridgeChannelProps & { bridgeKey?: string }) {
    super({ ...props, connected: false });
    this._bridgeKey = props?.bridgeKey ?? BRIDGE_KEY;
  }

  decorateOnMessageMiddleware(
    middlewares: ClientMiddleware[]
  ): ClientMiddleware[] {
    return middlewares.map((mw) =>
      mw === normalizeMessageChannelRawMessage ? processClientRawMessage : mw
    );
  }

  on(listener: (data: unknown) => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  send(data: unknown, _transfer?: Transferable[]): void {
    if (!this._bridge) {
      console.warn(
        '[ContextBridgeChannel] send called before bridge was set up.'
      );
      return;
    }
    this._bridge._send(data);
  }

  activate(): void {
    const bridge = (globalThis as Record<string, unknown>)[this._bridgeKey] as
      | ContextBridgeAPI
      | undefined;
    if (!bridge) {
      console.warn(
        `[ContextBridgeChannel] ${this._bridgeKey} not found on globalThis. ` +
          'Ensure createPageBridge() was called in preload.'
      );
      return;
    }

    this._bridge = bridge;

    bridge._onMessage((data: unknown) => {
      this._listeners.forEach((cb) => cb(data));
    });

    this._cleanupBridgeListener = () => {
      bridge._offMessage();
    };

    super.activate();
  }

  disconnect(): void {
    if (this._cleanupBridgeListener) {
      this._cleanupBridgeListener();
      this._cleanupBridgeListener = null;
    }
    this._listeners.clear();
    this._bridge = null;
    super.disconnect();
  }
}
