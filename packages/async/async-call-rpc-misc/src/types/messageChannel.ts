import { IpcRenderer, UtilityProcess, WebContents } from 'electron';
import MessageChannelProtocol from '../channel-protocol/MessageChannelProtocol';
import RPCServiceHost from '../rpc-service/RPCServiceHost';

export interface ChannelPort {
  on(event: 'message', listener: (messageEvent: MessageEvent) => void): this;
  removeListener(
    event: 'message',
    listener: (messageEvent: MessageEvent) => void
  ): this;
  postMessage(message: any, transfer?: MainPort[]): void;
}

export type UtilityMessageChannelPortStoreProps = {
  name: string;
  port: ParentPort;
  masterProcessName: string;
  clientMiddlewares?: ClientMiddleware[];
  senderMiddlewares?: SenderMiddleware[];
};

export type OnMessageEntry = {
  data: any;
  ports: any;
};
export type SenderEntry = any;

export type ClientMiddleware = (
  channel?: MessageChannelProtocol
) => (v: OnMessageEntry) => OnMessageEntry;

export type SenderMiddleware = (
  channel?: MessageChannelProtocol
) => (data: SenderEntry) => SenderEntry;

export type AbstractChannelProtocolProps = {
  serviceHost?: RPCServiceHost;
  connected?: boolean;
  description?: string;
  masterProcessName?: string;
  clientMiddlewares?: ClientMiddleware[];
  senderMiddlewares?: SenderMiddleware[];
};

export type DeferredMessageChannelProtocolProps =
  AbstractChannelProtocolProps & {
    port?: MainPort;
  };

export type MessageChannelProtocolProps = AbstractChannelProtocolProps & {
  port?: MainPort;
};

export type ProcessChannelProtocolProps = {
  process: UtilityProcess;
} & AbstractChannelProtocolProps;

export type IPCMainGlobalChannelProtocolProps = AbstractChannelProtocolProps & {
  channelName: string;
};

export type IPCMainChannelProtocolProps = {
  channelName: string;
  webContents: WebContents;
} & AbstractChannelProtocolProps;

export type IPCRendererChannelProtocolProps = {
  channelName: string;
  ipcRenderer: IpcRenderer;
  projectName: string;
} & AbstractChannelProtocolProps;

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

export type UtilityNodeJSProcess = NodeJS.Process;

export interface MainPort extends NodeJS.EventEmitter {
  // Docs: https://electronjs.org/docs/api/message-port-main

  /**
   * Emitted when the remote end of a MessagePortMain object becomes disconnected.
   */
  /**
   * Emitted when a MessagePortMain object receives a message.
   */
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
  /**
   * Disconnects the port, so it is no longer active.
   */
  close(): void;
  /**
   * Sends a message from the port, and optionally, transfers ownership of objects to
   * other browsing contexts.
   */
  postMessage(message: any, transfer?: MainPort[]): void;
  /**
   * Starts the sending of messages queued on the port. Messages will be queued until
   * this method is called.
   */
  start(): void;
}

export function isUtilityProcess(
  process: NodeJS.Process
): process is UtilityNodeJSProcess {
  return !!(process as UtilityNodeJSProcess).parentPort;
}
