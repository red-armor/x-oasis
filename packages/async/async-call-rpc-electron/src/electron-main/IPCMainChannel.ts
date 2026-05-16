import { AbstractChannelProtocol } from '@x-oasis/async-call-rpc/core';
import { ipcMain } from 'electron';
import {
  IPCMainChannelProps,
  IpcMainEvent,
  IpcMainLikeMessage,
  MessagePortMain,
  WebContents,
} from '../types';

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
    /**
     * CRITICAL IMPLEMENTATION NOTE:
     *
     * Electron IPC message structure vs MessageEvent:
     * - Electron's ipcMain.on(channel, handler) receives: (event, ...args)
     * - MessageEvent has: {data, ports}
     *
     * The async-call-rpc framework expects MessageEvent-like structure with ports.
     * This handler must reconstruct that from Electron's (event, ...args) format.
     *
     * ## Port Transfer in Electron:
     *
     * When renderer process sends with transfer:
     * ```typescript
     * ipcRenderer.postMessage(channelName, data, [port])
     * ```
     *
     * Main side receives in IPC listener:
     * ```typescript
     * ipcMain.on(channelName, (event) => {
     *   event.ports  // ← Contains the transferred MessagePort(s)!
     *   args[0]      // ← Contains the main data
     * })
     * ```
     *
     * This handler MUST extract event.ports and include it in normalized message.
     * If ports is not passed to listener, downstream middleware won't have access
     * to Transferable objects and PortSuccess responses will fail.
     *
     * ## Sender Routing:
     *
     * In bound mode: only process messages from the expected sender
     * In broadcast mode: remember the sender for routing replies back
     */
    const handler = (_event: IpcMainEvent, ...args: unknown[]): void => {
      // STEP 1: Handle sender routing (bound vs broadcast mode)
      if (this._acceptAllSenders) {
        // Broadcast mode: remember sender so replies route back to it
        // This allows the same channel to serve multiple renderers
        this._lastSender = _event.sender;
      } else if (_event.sender !== this._webContents) {
        // Bound mode: filter out other senders
        // Only process messages from the expected renderer
        return;
      }

      // STEP 2: Extract the main data from arguments
      // Electron sends data as separate arguments after event
      const data = args.length === 1 ? args[0] : args;

      // STEP 3: Extract ports from Electron IPC event
      // _event.ports contains Transferable objects transferred via postMessage transfer list
      // This is crucial for MessagePort transfer scenarios
      // If no ports were transferred, _event.ports is undefined (will be handled by normalize middleware)
      const ports = _event.ports || [];

      // STEP 4: Call listener with MessageEvent-like structure
      // The listener expects: {data, sender, ports}
      // The sender field is used for reply routing
      // The ports field is used by handleResponse middleware
      listener({
        data,
        sender: _event.sender,
        ports, // ← CRITICAL: Don't forget to include ports!
      } as IpcMainLikeMessage);
    };

    ipcMain.on(this._channelName, handler);

    // Return cleanup function
    return () => {
      ipcMain.off(this._channelName, handler);
    };
  }

  send(data: unknown, transfer?: MessagePortMain[]): void {
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
      return;
    }

    if (transfer && transfer.length) {
      target.postMessage(this._channelName, data, transfer);
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
