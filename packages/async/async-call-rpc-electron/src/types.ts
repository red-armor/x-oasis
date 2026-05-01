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
  port: MainPort;
} & AbstractChannelProtocolProps;

export type UtilityProcessChannelProps = {
  process: UtilityProcess;
} & AbstractChannelProtocolProps;

export type UtilityProcessParentPortChannelProps = {
  parentPort: ParentPort;
} & AbstractChannelProtocolProps;

export type IPCMainChannelProps = {
  channelName: string;
  webContents: WebContents;
} & AbstractChannelProtocolProps;

export type IPCRendererChannelProps = {
  channelName: string;
  ipcRenderer: IpcRenderer;
  projectName: string;
} & AbstractChannelProtocolProps;

// ─── Re-exports for convenience ──────────────────────────────────────────────

export type {
  IpcRenderer,
  IpcMain,
  IpcMainEvent,
  IpcRendererEvent,
  UtilityProcess,
  WebContents,
};
