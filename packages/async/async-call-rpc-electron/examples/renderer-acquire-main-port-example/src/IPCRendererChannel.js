'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const async_call_rpc_1 = require('@x-oasis/async-call-rpc');
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
class IPCRendererChannel extends async_call_rpc_1.AbstractChannelProtocol {
  _channelName;
  _ipcRenderer;
  _projectName;
  constructor(props) {
    const { channelName, ipcRenderer, projectName, ...protocolOptions } = props;
    super(protocolOptions);
    this._channelName = channelName;
    this._ipcRenderer = ipcRenderer;
    this._projectName = projectName;
  }
  on(listener) {
    const handler = (_event, ...args) => {
      const data = args.length === 1 ? args[0] : args;
      listener({ data });
    };
    this._ipcRenderer.on(this._channelName, handler);
    return () => {
      this._ipcRenderer.removeListener(this._channelName, handler);
    };
  }
  send(data, transfer) {
    if (transfer && transfer.length) {
      this._ipcRenderer.postMessage(this._channelName, data, transfer);
    } else {
      this._ipcRenderer.send(this._channelName, data);
    }
  }
  disconnect() {
    this._ipcRenderer.removeAllListeners(this._channelName);
    super.disconnect();
  }
  get channelName() {
    return this._channelName;
  }
  get projectName() {
    return this._projectName;
  }
}
exports.default = IPCRendererChannel;
