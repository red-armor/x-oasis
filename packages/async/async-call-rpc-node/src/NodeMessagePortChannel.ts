import {
  AbstractChannelProtocol,
  AbstractChannelProtocolProps,
} from '@x-oasis/async-call-rpc';
import { MessagePort } from 'worker_threads';

const TRANSFERABLE_TYPES = new Set(['tar', 'taar', 'ps', 'pas']);

function isMessagePort(value: unknown): value is MessagePort {
  if (value == null || typeof value !== 'object') return false;
  return typeof (value as any).postMessage === 'function';
}

function extractPortsFromBody(body: any[]): {
  ports: MessagePort[];
  cleaned: any[];
} {
  const ports: MessagePort[] = [];
  const cleaned = body.map((item) => {
    if (isMessagePort(item)) {
      ports.push(item);
      return null;
    }
    if (Array.isArray(item)) {
      const subPorts: MessagePort[] = [];
      const subCleaned = item.map((sub) => {
        if (isMessagePort(sub)) {
          subPorts.push(sub);
          return null;
        }
        return sub;
      });
      ports.push(...subPorts);
      return subCleaned;
    }
    return item;
  });
  return { ports, cleaned };
}

export type NodeMessagePortChannelProps = {
  port?: MessagePort;
} & AbstractChannelProtocolProps;

export class NodeMessagePortChannel extends AbstractChannelProtocol {
  private _port: MessagePort | null;
  private _detachListener: (() => void) | null;
  private _pendingListener: ((data: unknown) => void) | null;

  constructor(props: NodeMessagePortChannelProps = {}) {
    const { port, ...protocolOptions } = props;
    super(port ? protocolOptions : { ...protocolOptions, connected: false });
    this._port = null;
    this._detachListener = null;
    this._pendingListener = null;

    if (port) {
      this._attachPort(port);
    }
  }

  bindPort(port: MessagePort): void {
    if (this._port) return;
    this._attachPort(port);
    this.activate();
  }

  on(listener: (data: unknown) => void): void | (() => void) {
    if (!this._port) {
      this._pendingListener = listener;
      return () => {
        if (this._pendingListener === listener) {
          this._pendingListener = null;
        }
        if (this._detachListener) {
          this._detachListener();
          this._detachListener = null;
        }
      };
    }
    return this._wireListener(this._port, listener);
  }

  send(data: unknown, transfer?: MessagePort[]): void {
    if (!this._port) {
      console.warn(
        '[NodeMessagePortChannel] send called before port was bound.'
      );
      return;
    }

    if (transfer && transfer.length > 0) {
      try {
        const parsed = JSON.parse(data as string);
        const header = parsed?.[0];
        const msgType = header?.[0];
        if (TRANSFERABLE_TYPES.has(msgType)) {
          parsed[1] = transfer.length === 1 ? [transfer[0]] : [...transfer];
          this._port.postMessage(parsed, transfer);
          return;
        }
      } catch {}
      this._port.postMessage(data, transfer);
    } else {
      this._port.postMessage(data);
    }
  }

  disconnect(): void {
    if (this._port) {
      this._port.close();
    }
    super.disconnect();
  }

  private _attachPort(port: MessagePort): void {
    this._port = port;
    port.start?.();
    port.on('close', () => this.disconnect());
    if (this._pendingListener) {
      this._detachListener = this._wireListener(port, this._pendingListener);
      this._pendingListener = null;
    }
  }

  private _wireListener(
    port: MessagePort,
    listener: (data: unknown) => void
  ): () => void {
    const handler = (value: unknown): void => {
      let ports: MessagePort[] = [];
      let normalizedData: unknown = value;

      if (typeof value === 'object' && value !== null) {
        const parsed = value as any[];
        if (Array.isArray(parsed)) {
          const header = parsed[0];
          const msgType = header?.[0];
          if (TRANSFERABLE_TYPES.has(msgType)) {
            const body = parsed[1] || [];
            const extracted = extractPortsFromBody(
              Array.isArray(body) ? body : [body]
            );
            if (extracted.ports.length > 0) {
              ports = extracted.ports;
              parsed[1] = [];
              normalizedData = JSON.stringify(parsed);
            }
          } else {
            normalizedData = JSON.stringify(value);
          }
        } else {
          normalizedData = JSON.stringify(value);
        }
      }

      listener({ data: normalizedData, ports } as any);
    };
    port.on('message', handler);
    return () => {
      port.off('message', handler);
    };
  }
}
