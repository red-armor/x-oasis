'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const async_call_rpc_1 = require('@x-oasis/async-call-rpc');
const electron_1 = require('electron');
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
class IPCMainChannel extends async_call_rpc_1.AbstractChannelProtocol {
  _channelName;
  _webContents;
  _acceptAllSenders;
  _lastSender;
  constructor(props) {
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
  on(listener) {
    const handler = (_event, ...args) => {
      if (this._acceptAllSenders) {
        // Broadcast mode: remember sender so replies route back to it.
        this._lastSender = _event.sender;
      } else if (_event.sender !== this._webContents) {
        // Bound mode: filter out other senders.
        return;
      }
      const data = args.length === 1 ? args[0] : args;
      listener({ data, sender: _event.sender });
    };
    electron_1.ipcMain.on(this._channelName, handler);
    return () => {
      electron_1.ipcMain.off(this._channelName, handler);
    };
  }
  send(data, transfer) {
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
      target.postMessage(this._channelName, data, transfer);
    } else {
      target.send(this._channelName, data);
    }
  }
  disconnect() {
    super.disconnect();
  }
  get channelName() {
    return this._channelName;
  }
}
exports.default = IPCMainChannel;
