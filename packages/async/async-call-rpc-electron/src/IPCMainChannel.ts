import { AbstractChannelProtocol } from '@x-oasis/async-call-rpc';
import {
  IPCMainChannelProps,
  IpcMain,
  IpcMainEvent,
  WebContents,
} from './types';

/**
 * RPC channel protocol for Electron's `ipcMain` side.
 *
 * This channel runs in the **main process** and communicates with
 * a renderer process via a named IPC channel.
 *
 * Two modes:
 *
 * 1. **Bound** (default): pass a specific `webContents`. Messages from
 *    other senders on the same channel are filtered out, and the channel
 *    auto-disconnects when that `WebContents` is destroyed.
 *
 * 2. **Broadcast** (`acceptAllSenders: true`): listen on the channel
 *    regardless of source, capture each incoming `event.sender` and use
 *    it as the reply target. Useful for broker channels where many
 *    renderers may ask the main process to wire up ports.
 *
 * Messages are sent through `webContents.send(channelName, data)` and
 * received via `ipcMain.on(channelName, ...)`. When a transfer list is
 * provided, `webContents.postMessage(channelName, data, transfer)` is
 * used instead.
 *
 * ## Usage
 *
 * ```ts
 * import { ipcMain, BrowserWindow } from 'electron';
 * import { IPCMainChannel } from '@x-oasis/async-call-rpc-electron';
 *
 * const win = new BrowserWindow({ ... });
 * const channel = new IPCMainChannel({
 *   channelName: 'my-rpc',
 *   webContents: win.webContents,
 *   description: 'main→renderer',
 * });
 * ```
 *
 * @see {@link IPCRendererChannel} for the renderer-side counterpart
 */
export default class IPCMainChannel extends AbstractChannelProtocol {
  private _channelName: string;
  private _webContents?: WebContents;
  private _acceptAllSenders: boolean;
  private _lastSender?: WebContents;

  constructor(props: IPCMainChannelProps) {
    const {
      channelName,
      webContents,
      acceptAllSenders = false,
      ...protocolOptions
    } = props;
    super(protocolOptions);
    this._channelName = channelName;
    this._webContents = webContents;
    this._acceptAllSenders = acceptAllSenders;

    // Auto-disconnect when the bound WebContents is destroyed.
    // Skipped in broadcast mode — no single sender to track.
    if (!acceptAllSenders && this._webContents) {
      this._webContents.on('destroyed', () => {
        this.disconnect();
      });
    }
  }

  on(listener: (data: unknown) => void): void | (() => void) {
    let ipcMain: IpcMain;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      ipcMain = require('electron').ipcMain;
    } catch {
      console.warn(
        '[IPCMainChannel] electron.ipcMain is not available. ' +
          'This channel can only be used in Electron main process.'
      );
      return;
    }

    const handler = (_event: IpcMainEvent, ...args: unknown[]): void => {
      if (this._acceptAllSenders) {
        // Broadcast mode: remember sender so replies route back to it.
        this._lastSender = _event.sender;
      } else if (_event.sender !== this._webContents) {
        // Bound mode: filter out other senders.
        return;
      }
      const data = args.length === 1 ? args[0] : args;
      listener({ data, sender: _event.sender } as any);
    };

    ipcMain.on(this._channelName, handler);
    return () => {
      ipcMain.removeListener(this._channelName, handler);
    };
  }

  send(data: unknown, transfer?: any[]): void {
    const target = this._acceptAllSenders
      ? this._lastSender
      : this._webContents;
    if (!target) {
      console.warn(
        `[IPCMainChannel] Cannot send on "${this._channelName}": no target WebContents.`
      );
      return;
    }
    if (target.isDestroyed && target.isDestroyed()) {
      console.warn(
        `[IPCMainChannel] Cannot send on "${this._channelName}": WebContents is destroyed.`
      );
      return;
    }
    if (transfer && transfer.length) {
      (target as any).postMessage(this._channelName, data, transfer);
    } else {
      target.send(this._channelName, data);
    }
  }

  disconnect(): void {
    super.disconnect();
  }

  get channelName(): string {
    return this._channelName;
  }
}
