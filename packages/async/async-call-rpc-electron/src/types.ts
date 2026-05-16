import { AbstractChannelProtocolProps } from '@x-oasis/async-call-rpc/core';
import {
  IpcRenderer,
  IpcMain,
  IpcMainEvent,
  IpcRendererEvent,
  UtilityProcess,
  WebContents,
  MessagePortMain,
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
  on(event: 'close', listener: () => void): this;
  on(event: 'message', listener: (messageEvent: MessageEvent) => void): this;
  off(event: 'close', listener: () => void): this;
  off(event: 'message', listener: (messageEvent: MessageEvent) => void): this;
  once(event: 'close', listener: () => void): this;
  once(event: 'message', listener: (messageEvent: MessageEvent) => void): this;
  addListener(event: 'close', listener: () => void): this;
  addListener(
    event: 'message',
    listener: (messageEvent: MessageEvent) => void
  ): this;
  removeListener(event: 'close', listener: () => void): this;
  removeListener(
    event: 'message',
    listener: (messageEvent: MessageEvent) => void
  ): this;
  close(): void;
  postMessage(message: unknown, transfer?: MainPort[]): void;
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
  postMessage(message: unknown, transfer?: MainPort[]): void;
}

// ─── Props types ─────────────────────────────────────────────────────────────

export type MessagePortMainChannelProps = {
  port?: MessagePortMain;
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

export type ContextBridgeChannelProps = AbstractChannelProtocolProps;

// ─── IPC message structure types ─────────────────────────────────────────────

export interface IpcLikeMessage {
  data: unknown;
  ports: MessagePort[];
  [key: string]: unknown;
}

export interface IpcMainLikeMessage {
  data: unknown;
  sender: WebContents;
  ports: MessagePortMain[];
  [key: string]: unknown;
}

export interface ActivationConnectionContext {
  connectionId: string;
  role: 'initiator' | 'receiver';
}

// ─── Re-exports for convenience ──────────────────────────────────────────────

export type {
  IpcRenderer,
  IpcMain,
  IpcMainEvent,
  IpcRendererEvent,
  UtilityProcess,
  WebContents,
  MessagePortMain,
};
