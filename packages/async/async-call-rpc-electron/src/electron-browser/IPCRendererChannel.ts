import { AbstractChannelProtocol } from '@x-oasis/async-call-rpc';
import {
  IPCRendererChannelProps,
  IpcRenderer,
  IpcRendererEvent,
} from '../types';

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
    /**
     * CRITICAL IMPLEMENTATION NOTE:
     *
     * Electron IPC message structure vs MessageEvent:
     * - Electron's ipcRenderer.on(channel, handler) receives: (event, ...args)
     * - MessageEvent has: {data, ports}
     *
     * The async-call-rpc framework expects MessageEvent-like structure with ports.
     * This handler must reconstruct that from Electron's (event, ...args) format.
     *
     * Reference:
     * - Electron IPC: https://www.electronjs.org/docs/latest/api/ipc-renderer#ipcrendereronchannel-listener
     * - MessageEvent: https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent
     *
     * ## Port Transfer in Electron:
     *
     * When main process sends with transfer:
     * ```typescript
     * webContents.postMessage(channelName, data, [port])
     * ```
     *
     * Renderer side receives in IPC listener:
     * ```typescript
     * ipcRenderer.on(channelName, (event) => {
     *   event.ports  // ← Contains the transferred MessagePort(s)!
     *   args[0]      // ← Contains the main data
     * })
     * ```
     *
     * This handler MUST extract event.ports and include it in normalized message.
     * If ports is not passed to listener, downstream middleware won't have access
     * to Transferable objects and PortSuccess responses will fail.
     */
    const handler = (_event: IpcRendererEvent, ...args: unknown[]): void => {
      // STEP 1: Extract the main data from arguments
      // Electron sends data as separate arguments after event
      const data = args.length === 1 ? args[0] : args;

      // STEP 2: Extract ports from Electron IPC event
      // _event.ports contains Transferable objects transferred via postMessage transfer list
      // This is crucial for MessagePort transfer scenarios
      // If no ports were transferred, _event.ports is undefined (will be handled by normalize middleware)
      const ports = _event.ports || [];

      // STEP 3: Call listener with MessageEvent-like structure
      // The listener expects: {data, ports, event}
      // This structure is then normalized by normalize middleware to NormalizedRawMessageOutput
      // Normalize middleware relies on the ports being here!
      listener({
        data,
        ports, // ← CRITICAL: Don't forget to include ports!
        event: _event,
      } as any);
    };

    this._ipcRenderer.on(this._channelName, handler);

    // Return cleanup function
    return () => {
      this._ipcRenderer.removeListener(this._channelName, handler);
    };
  }

  send(data: unknown, transfer?: any[]): void {
    /**
     * STEP 1: Check if there are Transferable objects to send
     * If transfer list is provided, use postMessage for Transferable support
     * Otherwise, use send for simple messages
     */
    if (transfer && transfer.length) {
      // CASE 1: Sending with Transferable objects
      // Use postMessage which supports transfer list
      // This makes the Transferable objects appear in receiver's event.ports
      (this._ipcRenderer as any).postMessage(this._channelName, data, transfer);
    } else {
      // CASE 2: Simple message without Transferables
      // Use regular send, which is slightly more efficient
      this._ipcRenderer.send(this._channelName, data);
    }
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
