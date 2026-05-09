import { AbstractChannelProtocolProps } from '@x-oasis/async-call-rpc';
import {
  IpcRenderer,
  IpcMain,
  IpcMainEvent,
  IpcRendererEvent,
  UtilityProcess,
  WebContents,
} from 'electron';

// ─── MessagePortMain interfaces ──────────────────────────────────────────────

/**
 * Represents Electron's `MessagePortMain`.
 *
 * Uses Node.js `EventEmitter`-style API (`on`/`off`/`once`)
 * instead of the Web `addEventListener`.
 *
 * @see https://www.electronjs.org/docs/latest/api/message-port-main
 */
export interface MainPort extends NodeJS.EventEmitter {
  on(event: 'close', listener: Function): this;
  on(event: 'message', listener: (messageEvent: MessageEvent) => void): this;
  off(event: 'close', listener: Function): this;
  off(event: 'message', listener: (messageEvent: MessageEvent) => void): this;
  once(event: 'close', listener: Function): this;
  once(event: 'message', listener: (messageEvent: MessageEvent) => void): this;
  addListener(event: 'close', listener: Function): this;
  addListener(
    event: 'message',
    listener: (messageEvent: MessageEvent) => void
  ): this;
  removeListener(event: 'close', listener: Function): this;
  removeListener(
    event: 'message',
    listener: (messageEvent: MessageEvent) => void
  ): this;
  close(): void;
  postMessage(message: any, transfer?: MainPort[]): void;
  start(): void;
}

/**
 * Represents Electron's `parentPort` in a UtilityProcess.
 *
 * @see https://www.electronjs.org/docs/latest/api/utility-process#processparentport
 */
export interface ParentPort extends NodeJS.EventEmitter {
  on(event: 'message', listener: (messageEvent: MessageEvent) => void): this;
  once(event: 'message', listener: (messageEvent: MessageEvent) => void): this;
  addListener(
    event: 'message',
    listener: (messageEvent: MessageEvent) => void
  ): this;
  removeListener(
    event: 'message',
    listener: (messageEvent: MessageEvent) => void
  ): this;
  postMessage(message: any): void;
}

// ─── Props types ─────────────────────────────────────────────────────────────

export type MessagePortMainChannelProps = {
  /**
   * The `MessagePortMain` to wrap. May be omitted to construct a
   * disconnected channel that queues sends; bind the port later via
   * {@link ElectronMessagePortMainChannel.bindPort}.
   */
  port?: MainPort;
} & AbstractChannelProtocolProps;

export type UtilityProcessChannelProps = {
  process: UtilityProcess;
} & AbstractChannelProtocolProps;

export type UtilityProcessParentPortChannelProps = {
  parentPort: ParentPort;
} & AbstractChannelProtocolProps;

export type IPCMainChannelProps = {
  channelName: string;
  /**
   * The renderer to talk to. Omit when `acceptAllSenders: true` — the
   * channel will then talk back to whichever sender most recently sent
   * a message on `channelName`.
   */
  webContents?: WebContents;
  /**
   * Listen on `channelName` regardless of which `webContents` sent the
   * message, and reply via `event.sender`. Useful for broker channels
   * where many renderers ask the main process to wire up ports.
   *
   * When true, `webContents` may be omitted; `disconnect`-on-destroyed
   * is a no-op (there's no single sender to track).
   */
  acceptAllSenders?: boolean;
} & AbstractChannelProtocolProps;

export type IPCRendererChannelProps = {
  channelName: string;
  ipcRenderer: IpcRenderer;
  projectName: string;
} & AbstractChannelProtocolProps;

// ─── ContextBridge types (shared between preload & renderer) ──────────────────

export interface ContextBridgeAPI {
  _send: (data: unknown) => void;
  _onMessage: (cb: (data: unknown) => void) => void;
  _offMessage: () => void;
}

export interface ContextBridgeIPCAPI {
  _send: (data: unknown) => void;
  _onMessage: (cb: (data: unknown) => void) => void;
  _offMessage: () => void;
}

export type ContextBridgeChannelProps = AbstractChannelProtocolProps;

// ─── Re-exports for convenience ──────────────────────────────────────────────

export type {
  IpcRenderer,
  IpcMain,
  IpcMainEvent,
  IpcRendererEvent,
  UtilityProcess,
  WebContents,
};
