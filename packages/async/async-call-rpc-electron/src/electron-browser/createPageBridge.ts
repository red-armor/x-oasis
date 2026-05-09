import { contextBridge } from 'electron';
import IPCRendererChannel from './IPCRendererChannel';
import { registerOrchestratorHandler } from './registerOrchestratorHandler';
import { ContextBridgeAPI, ContextBridgeIPCAPI, IpcRenderer } from '../types';
import { RPCMessageChannel } from '@x-oasis/async-call-rpc-web';

const BRIDGE_KEY = '__rpc_bridge__' as const;
const IPC_BRIDGE_KEY = '__rpc_ipc_bridge__' as const;

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

  const realChannel = new RPCMessageChannel({
    description: description ?? `page-bridge:${channelName}`,
  });

  const messageHandlers = new Set<(data: unknown) => void>();
  const ipcMessageHandlers = new Set<(data: unknown) => void>();

  let bridgePort: MessagePort | null = null;
  let bridgePortListener: (() => void) | null = null;

  registerOrchestratorHandler(ipcChannel, (port: any) => {
    if (bridgePortListener) {
      bridgePortListener();
      bridgePortListener = null;
    }
    if (bridgePort) {
      try {
        bridgePort.close();
      } catch {}
    }
    bridgePort = port;
    const handler = (ev: MessageEvent) => {
      messageHandlers.forEach((cb) => cb(ev.data));
    };
    port.addEventListener('message', handler);
    port.start();
    bridgePortListener = () => port.removeEventListener('message', handler);
    realChannel.bindPort(port, { rebind: true });
  });

  const bridge: ContextBridgeAPI = {
    _send: (data: unknown) => {
      if (bridgePort) {
        bridgePort.postMessage(data);
      } else {
        realChannel.send(data);
      }
    },
    _onMessage: (cb: (data: unknown) => void) => {
      messageHandlers.add(cb);
    },
    _offMessage: () => {
      messageHandlers.clear();
    },
  };

  const ipcBridge: ContextBridgeIPCAPI = {
    _send: (data: unknown) => {
      ipcChannel.send(data);
    },
    _onMessage: (cb: (data: unknown) => void) => {
      ipcMessageHandlers.add(cb);
    },
    _offMessage: () => {
      ipcMessageHandlers.clear();
    },
  };

  ipcChannel.on((rawMessage: any) => {
    const data = rawMessage?.data ?? rawMessage;
    const ports = rawMessage?.ports ?? [];
    if (ports.length === 0) {
      ipcMessageHandlers.forEach((cb) => cb(data));
    }
  });

  try {
    contextBridge.exposeInMainWorld(BRIDGE_KEY, {
      _send: bridge._send,
      _onMessage: bridge._onMessage,
      _offMessage: bridge._offMessage,
    });
    contextBridge.exposeInMainWorld(IPC_BRIDGE_KEY, {
      _send: ipcBridge._send,
      _onMessage: ipcBridge._onMessage,
      _offMessage: ipcBridge._offMessage,
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
    (globalThis as any)[IPC_BRIDGE_KEY] = {
      _send: ipcBridge._send,
      _onMessage: ipcBridge._onMessage,
      _offMessage: ipcBridge._offMessage,
    };
  }

  return { channel: realChannel, ipcChannel };
}
