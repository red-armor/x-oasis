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
 * a specific `BrowserWindow`'s renderer process via a named IPC channel.
 *
 * Messages are sent through `webContents.send(channelName, data)` and
 * received via `ipcMain.on(channelName, ...)`.
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
 * @remarks
 * - Each `IPCMainChannel` is bound to **one** `WebContents` instance.
 *   For multiple windows, create one channel per window.
 * - The `channelName` must match the one used by the corresponding
 *   {@link IPCRendererChannel} in the renderer process.
 * - Messages from other windows on the same channel are filtered out
 *   by comparing `event.sender` with the bound `webContents`.
 * - Auto-disconnects when the `WebContents` is destroyed.
 *
 * @see {@link IPCRendererChannel} for the renderer-side counterpart
 */
export default class IPCMainChannel extends AbstractChannelProtocol {
  private _channelName: string;
  private _webContents: WebContents;

  constructor(props: IPCMainChannelProps) {
    const { channelName, webContents, ...protocolOptions } = props;
    super(protocolOptions);
    this._channelName = channelName;
    this._webContents = webContents;

    // Auto-disconnect when the WebContents is destroyed
    this._webContents.on('destroyed', () => {
      this.disconnect();
    });
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
      // Filter: only accept messages from the bound WebContents
      if (_event.sender !== this._webContents) {
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

  send(data: unknown): void {
    if (this._webContents.isDestroyed()) {
      console.warn(
        `[IPCMainChannel] Cannot send on "${this._channelName}": WebContents is destroyed.`
      );
      return;
    }
    this._webContents.send(this._channelName, data);
  }

  disconnect(): void {
    super.disconnect();
  }

  get channelName(): string {
    return this._channelName;
  }
}
