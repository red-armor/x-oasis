import IPCRendererChannel from './IPCRendererChannel';
import { registerOrchestratorHandler } from './registerOrchestratorHandler';
import { ContextBridgeAPI } from './ContextBridgeChannel';
import { IpcRenderer } from '../types';

const BRIDGE_KEY = '__rpc_bridge__' as const;

export interface CreatePageBridgeOptions {
  ipcRenderer: IpcRenderer;
  channelName: string;
  description?: string;
}

export function createPageBridge(options: CreatePageBridgeOptions): {
  channel: any;
  ipcChannel: IPCRendererChannel;
} {
  const { ipcRenderer, channelName, description } = options;

  const ipcChannel = new IPCRendererChannel({
    channelName,
    ipcRenderer,
    projectName: channelName,
  });

  let RPCMessageChannel: any;
  try {
    RPCMessageChannel = require('@x-oasis/async-call-rpc-web').default;
  } catch {
    throw new Error(
      '[createPageBridge] @x-oasis/async-call-rpc-web is required but not installed. ' +
        'Install it with: npm install @x-oasis/async-call-rpc-web'
    );
  }

  const realChannel = new RPCMessageChannel({
    description: description ?? `page-bridge:${channelName}`,
  });

  registerOrchestratorHandler(ipcChannel, (port: any) => {
    realChannel.bindPort(port, { rebind: true });
  });

  const messageHandlers = new Set<(data: unknown) => void>();

  const bridge: ContextBridgeAPI = {
    _send: (data: unknown) => {
      realChannel.send(data);
    },
    _onMessage: (cb: (data: unknown) => void) => {
      messageHandlers.add(cb);
    },
    _offMessage: () => {
      messageHandlers.clear();
    },
  };

  try {
    const { contextBridge } = require('electron');
    contextBridge.exposeInMainWorld(BRIDGE_KEY, {
      _send: bridge._send,
      _onMessage: bridge._onMessage,
      _offMessage: bridge._offMessage,
    });
  } catch {
    console.warn(
      '[createPageBridge] contextBridge not available. ' +
        'Falling back to globalThis. This should only happen in tests.'
    );
    (globalThis as any)[BRIDGE_KEY] = {
      _send: bridge._send,
      _onMessage: bridge._onMessage,
      _offMessage: bridge._offMessage,
    };
  }

  realChannel.on((data: unknown) => {
    messageHandlers.forEach((cb) => cb(data));
  });

  return { channel: realChannel, ipcChannel };
}
