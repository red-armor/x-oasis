import {
  AbstractChannelProtocol,
  AbstractChannelProtocolProps,
} from '@x-oasis/async-call-rpc';
import { MessagePort } from 'worker_threads';

/**
 * Props for {@link NodeMessagePortChannel}.
 */
export type NodeMessagePortChannelProps = {
  /**
   * The `MessagePort` instance from `worker_threads.MessageChannel`.
   *
   * May be omitted to construct a disconnected channel that queues
   * sends; bind the port later via {@link NodeMessagePortChannel.bindPort}.
   */
  port?: MessagePort;
} & AbstractChannelProtocolProps;

/**
 * RPC channel protocol for Node.js `worker_threads.MessagePort`.
 *
 * Wraps a `MessagePort` (from `new require('worker_threads').MessageChannel()`)
 * for bidirectional RPC communication between Node.js workers.
 *
 * ## Late port binding
 *
 * The `port` may be supplied at construction time, or attached later via
 * {@link bindPort}. The "construct now, bind later" pattern is useful when
 * the port arrives as a transferred object from a parent worker. While
 * unbound, the channel is in the disconnected state — sends queue and flush
 * automatically when {@link bindPort} is called.
 *
 * ## Usage
 *
 * ```ts
 * import { Worker, MessageChannel } from 'worker_threads';
 * import { NodeMessagePortChannel } from '@x-oasis/async-call-rpc-node';
 *
 * const { port1, port2 } = new MessageChannel();
 *
 * // Use port1 in the main thread
 * const channel = new NodeMessagePortChannel({ port: port1 });
 *
 * // Transfer port2 to worker
 * const worker = new Worker('./worker.js', { workerData: { port: port2 }, transferList: [port2] });
 * ```
 *
 * **In worker.js:**
 * ```ts
 * import { workerData } from 'worker_threads';
 * import { NodeMessagePortChannel } from '@x-oasis/async-call-rpc-node';
 *
 * const channel = new NodeMessagePortChannel({ port: workerData.port });
 * ```
 *
 * @see https://nodejs.org/api/worker_threads.html#class-messagechannel
 */
export class NodeMessagePortChannel extends AbstractChannelProtocol {
  private _port: MessagePort | null;
  private _detachListener: (() => void) | null;
  private _pendingListener: ((data: unknown) => void) | null;

  constructor(props: NodeMessagePortChannelProps = {}) {
    const { port, ...protocolOptions } = props;
    // When no port is supplied, start disconnected so sends queue.
    super(port ? protocolOptions : { ...protocolOptions, connected: false });
    this._port = null;
    this._detachListener = null;
    this._pendingListener = null;

    if (port) {
      this._attachPort(port);
    }
  }

  /**
   * Attach a `MessagePort` to a previously-unbound channel and activate it.
   * Queued sends will flush via the framework's `resumePendingEntry` on the
   * `onDidConnected` event.
   *
   * No-op if a port is already bound.
   */
  bindPort(port: MessagePort): void {
    if (this._port) return;
    this._attachPort(port);
    this.activate();
  }

  on(listener: (data: unknown) => void): void | (() => void) {
    if (!this._port) {
      // Defer: wire listener once bindPort attaches a port.
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
    // MessagePort must be started to receive messages.
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
    // worker_threads MessagePort emits the message value directly (not wrapped
    // in a MessageEvent), unlike the Web MessagePort API.
    const handler = (value: unknown): void => {
      // Normalise to a MessageEvent-like shape for the framework middleware.
      listener({ data: value } as any);
    };
    port.on('message', handler);
    return () => {
      port.off('message', handler);
    };
  }
}
