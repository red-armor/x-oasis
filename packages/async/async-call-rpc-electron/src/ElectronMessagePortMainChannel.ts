import { AbstractChannelProtocol } from '@x-oasis/async-call-rpc';
import { MainPort, MessagePortMainChannelProps } from './types';

/**
 * RPC channel protocol for Electron's `MessagePortMain`.
 *
 * Electron's `MessageChannelMain` creates a pair of `MessagePortMain`
 * instances for direct, high-performance communication between:
 * - Main process <-> Renderer process
 * - Main process <-> Utility process
 * - Renderer <-> Renderer (via main as relay)
 *
 * This class wraps a `MessagePortMain` for use in the **main process**.
 * For the renderer side, use `RPCMessageChannel` from
 * `@x-oasis/async-call-rpc-web` which works with the standard Web
 * `MessagePort` API.
 *
 * ## Late port binding
 *
 * The port may be supplied at construction time, or attached later via
 * {@link bindPort}. The "construct now, bind later" pattern is useful
 * for the port-broker flow: a service registers handlers and starts
 * accepting requests before the actual `MessagePortMain` arrives on a
 * transfer. While the port is unbound the channel is in the
 * disconnected state, so sends queue into `pendingSendEntries` and
 * flush automatically when {@link bindPort} fires `activate()`.
 *
 * ## Usage
 *
 * ```ts
 * import { MessageChannelMain } from 'electron';
 * import { ElectronMessagePortMainChannel } from '@x-oasis/async-call-rpc-electron';
 *
 * const { port1, port2 } = new MessageChannelMain();
 *
 * // Send port2 to the renderer process
 * win.webContents.postMessage('port', null, [port2]);
 *
 * // Use port1 in the main process
 * const channel = new ElectronMessagePortMainChannel({
 *   port: port1,
 *   description: 'main↔renderer (MessagePortMain)',
 * });
 *
 * // Or: bind later
 * const pending = new ElectronMessagePortMainChannel({ description: 'pending' });
 * pending.setServiceHost(host);
 * // ...later, when the port arrives:
 * pending.bindPort(port);
 * ```
 *
 * @see https://www.electronjs.org/docs/latest/api/message-channel-main
 * @see https://www.electronjs.org/docs/latest/api/message-port-main
 */
export default class ElectronMessagePortMainChannel extends AbstractChannelProtocol {
  private _port: MainPort | null;
  private _detachListener: (() => void) | null;
  private _pendingListener: ((data: unknown) => void) | null;

  constructor(props: MessagePortMainChannelProps = {}) {
    // When no port is supplied, start disconnected so sends queue.
    const { port, ...protocolOptions } = props;
    super(port ? protocolOptions : { ...protocolOptions, connected: false });
    this._port = null;
    this._detachListener = null;
    this._pendingListener = null;

    if (port) {
      this._attachPort(port);
    }
  }

  /**
   * Attach a `MessagePortMain` to a previously-unbound channel and
   * activate it. Queued sends will flush via the framework's
   * `resumePendingEntry` on the `onDidConnected` event.
   *
   * No-op if a port is already bound.
   */
  bindPort(port: MainPort): void {
    if (this._port) return;
    this._attachPort(port);
    this.activate();
  }

  on(listener: (data: unknown) => void): void | (() => void) {
    if (!this._port) {
      // Defer: the listener will be wired once bindPort attaches a port.
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

  send(data: unknown, transfer?: MainPort[]): void {
    if (!this._port) {
      console.warn(
        '[ElectronMessagePortMainChannel] send called before port was bound.'
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

  private _attachPort(port: MainPort): void {
    this._port = port;
    if (port.start) port.start();
    port.on('close', () => this.disconnect());
    if (this._pendingListener) {
      this._detachListener = this._wireListener(port, this._pendingListener);
      this._pendingListener = null;
    }
  }

  private _wireListener(
    port: MainPort,
    listener: (data: unknown) => void
  ): () => void {
    const handler = (messageEvent: MessageEvent): void => {
      listener(messageEvent);
    };
    port.on('message', handler);
    return () => {
      port.removeListener('message', handler);
    };
  }
}
