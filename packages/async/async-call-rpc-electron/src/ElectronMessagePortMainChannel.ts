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
 * For the renderer side, use `MessageChannel` from `@x-oasis/async-call-rpc-web`
 * which works with the standard Web `MessagePort` API.
 *
 * ## Usage
 *
 * ```ts
 * import { MessageChannelMain, BrowserWindow } from 'electron';
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
 * ```
 *
 * @remarks
 * - `MessagePortMain` uses Node.js `EventEmitter`-style API
 *   (`on`/`off`/`once`) instead of `addEventListener`.
 * - `port.start()` is called automatically in the constructor.
 * - The port auto-closes on `disconnect()`.
 *
 * @see https://www.electronjs.org/docs/latest/api/message-channel-main
 * @see https://www.electronjs.org/docs/latest/api/message-port-main
 */
export default class ElectronMessagePortMainChannel extends AbstractChannelProtocol {
  private _port: MainPort;

  constructor(props: MessagePortMainChannelProps) {
    const { port, ...protocolOptions } = props;
    super(protocolOptions);
    this._port = port;

    // MessagePortMain requires start() to begin receiving messages
    if (this._port.start) {
      this._port.start();
    }

    // Auto-disconnect when the remote end closes
    this._port.on('close', () => {
      this.disconnect();
    });
  }

  on(listener: (data: unknown) => void): void | (() => void) {
    const handler = (messageEvent: MessageEvent): void => {
      listener(messageEvent);
    };

    this._port.on('message', handler);
    return () => {
      this._port.removeListener('message', handler);
    };
  }

  send(data: unknown, transfer?: MainPort[]): void {
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
}
