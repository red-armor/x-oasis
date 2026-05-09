import {
  AbstractChannelProtocol,
  AbstractChannelProtocolProps,
} from '@x-oasis/async-call-rpc';

const BRIDGE_KEY = '__rpc_bridge__' as const;

export type ContextBridgeChannelProps = AbstractChannelProtocolProps;

export interface ContextBridgeAPI {
  _send: (data: unknown) => void;
  _onMessage: (cb: (data: unknown) => void) => void;
  _offMessage: () => void;
}

export default class ContextBridgeChannel extends AbstractChannelProtocol {
  private _bridge: ContextBridgeAPI | null = null;
  private _listeners = new Set<(data: unknown) => void>();
  private _cleanupBridgeListener: (() => void) | null = null;

  constructor(props?: ContextBridgeChannelProps) {
    super({ ...props, connected: false });
  }

  on(listener: (data: unknown) => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  send(data: unknown, transfer?: any[]): void {
    if (!this._bridge) {
      console.warn(
        '[ContextBridgeChannel] send called before bridge was set up.'
      );
      return;
    }
    this._bridge._send(data);
  }

  activate(): void {
    const bridge = (globalThis as any)[BRIDGE_KEY] as
      | ContextBridgeAPI
      | undefined;
    if (!bridge) {
      console.warn(
        `[ContextBridgeChannel] ${BRIDGE_KEY} not found on globalThis. ` +
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
