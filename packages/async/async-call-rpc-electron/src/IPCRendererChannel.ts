import { AbstractChannelProtocol } from '@x-oasis/async-call-rpc';
import {
  IPCRendererChannelProps,
  IpcRenderer,
  IpcRendererEvent,
} from './types';

/**
 * RPC channel protocol for Electron's `ipcRenderer` side.
 *
 * This channel runs in the **renderer process** and communicates with
 * the main process via a named IPC channel.
 *
 * ## Usage
 *
 * ```ts
 * import { ipcRenderer } from 'electron';
 * import { IPCRendererChannel } from '@x-oasis/async-call-rpc-electron';
 *
 * const channel = new IPCRendererChannel({
 *   channelName: 'my-rpc',
 *   ipcRenderer,
 *   projectName: 'my-app',
 *   description: 'renderer→main',
 * });
 * ```
 *
 * ## With contextBridge (recommended for production)
 *
 * ```ts
 * // preload.ts
 * const { contextBridge, ipcRenderer } = require('electron');
 * contextBridge.exposeInMainWorld('rpc', {
 *   send: (channel: string, data: unknown) => ipcRenderer.send(channel, data),
 *   on: (channel: string, fn: Function) => {
 *     ipcRenderer.on(channel, (_event, ...args) => fn(...args));
 *   },
 * });
 * ```
 *
 * @remarks
 * - The `channelName` must match the one used by the corresponding
 *   {@link IPCMainChannel} in the main process.
 * - The `projectName` is used to namespace messages when multiple
 *   projects share the same renderer process.
 *
 * @see {@link IPCMainChannel} for the main-process counterpart
 */
export default class IPCRendererChannel extends AbstractChannelProtocol {
  private _channelName: string;
  private _ipcRenderer: IpcRenderer;
  private _projectName: string;

  constructor(props: IPCRendererChannelProps) {
    const { channelName, ipcRenderer, projectName, ...protocolOptions } = props;
    super(protocolOptions);
    this._channelName = channelName;
    this._ipcRenderer = ipcRenderer;
    this._projectName = projectName;
  }

  on(listener: (data: unknown) => void): void | (() => void) {
    const handler = (_event: IpcRendererEvent, ...args: unknown[]): void => {
      const data = args.length === 1 ? args[0] : args;
      listener({ data } as any);
    };

    this._ipcRenderer.on(this._channelName, handler);
    return () => {
      this._ipcRenderer.removeListener(this._channelName, handler);
    };
  }

  send(data: unknown): void {
    this._ipcRenderer.send(this._channelName, data);
  }

  disconnect(): void {
    this._ipcRenderer.removeAllListeners(this._channelName);
    super.disconnect();
  }

  get channelName(): string {
    return this._channelName;
  }

  get projectName(): string {
    return this._projectName;
  }
}
