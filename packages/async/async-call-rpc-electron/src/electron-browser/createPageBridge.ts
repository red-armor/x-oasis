import { contextBridge } from 'electron';
import IPCRendererChannel from './IPCRendererChannel';
import { registerOrchestratorHandler } from './registerOrchestratorHandler';
import { ContextBridgeAPI, IpcRenderer, IpcLikeMessage } from '../types';
import { RPCMessageChannel } from '@x-oasis/async-call-rpc-web';
import { ORCHESTRATOR_SERVICE_PATH } from '@x-oasis/async-call-rpc';

const BRIDGE_KEY = '__rpc_bridge__' as const;
const IPC_BRIDGE_KEY = '__rpc_ipc_bridge__' as const;

export interface CreatePageBridgeOptions {
  ipcRenderer: IpcRenderer;
  channelName: string;
  description?: string;
  serviceRoutes?: Record<string, string>;
  defaultPeerId?: string;
}

export function getServicePath(data: unknown): string | undefined {
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return undefined;
    }
  }
  // Wire format: [[type, seqId, requestPath, methodName], body]
  // header = data[0] = [type, seqId, requestPath, methodName]
  // requestPath is at index 2 of the header array
  if (!Array.isArray(data) || !Array.isArray(data[0])) return undefined;
  const header = data[0]; // [type, seqId, requestPath, methodName]
  return typeof header[2] === 'string' ? header[2] : undefined;
}

export function resolvePeerId(connectionId: string): string | undefined {
  const parts = connectionId.split('--');
  if (parts.length !== 2) return undefined;
  return parts[0] === 'renderer' ? parts[1] : parts[0];
}

export interface ActivationHandlerContext {
  port: MessagePort;
  connectionId?: string;
  role?: 'initiator' | 'receiver';
}

export function createPageBridge(options: CreatePageBridgeOptions): {
  channel: RPCMessageChannel;
  ipcChannel: IPCRendererChannel;
} {
  const {
    ipcRenderer,
    channelName,
    description,
    serviceRoutes,
    defaultPeerId,
  } = options;

  const bridgeKey = BRIDGE_KEY;
  const ipcBridgeKey = IPC_BRIDGE_KEY;

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

  const peerPortMap = new Map<string, MessagePort>();
  const servicePortMap = new Map<string, MessagePort>();

  if (serviceRoutes) {
    for (const [servicePath, peerId] of Object.entries(serviceRoutes)) {
      const peer = peerPortMap.get(peerId);
      if (peer) {
        servicePortMap.set(servicePath, peer);
      }
    }
  }

  let firstPort: MessagePort | null = null;

  registerOrchestratorHandler(ipcChannel, (ctx: ActivationHandlerContext) => {
    const port: MessagePort =
      ctx && typeof ctx === 'object' && 'port' in ctx
        ? ctx.port
        : (ctx as unknown as MessagePort);

    let resolvedPeerId: string | undefined;

    if ('connectionId' in ctx && typeof ctx.connectionId === 'string') {
      resolvedPeerId = resolvePeerId(ctx.connectionId);
      if (resolvedPeerId) {
        peerPortMap.set(resolvedPeerId, port);
        if (serviceRoutes) {
          for (const [servicePath, routePeerId] of Object.entries(
            serviceRoutes
          )) {
            if (routePeerId === resolvedPeerId) {
              servicePortMap.set(servicePath, port);
            }
          }
        }
      }
    }

    const handler = (ev: MessageEvent) => {
      const data = ev.data;
      const servicePath = getServicePath(data);
      if (servicePath) {
        servicePortMap.set(servicePath, port);
      }
      messageHandlers.forEach((cb) => cb(data));
    };
    port.addEventListener('message', handler);
    port.start();

    const resolvedAsDefault =
      !defaultPeerId || (resolvedPeerId && resolvedPeerId === defaultPeerId);

    if (resolvedAsDefault) {
      firstPort = port;
      realChannel.bindPort(port, { rebind: true });
    }
  });

  const getDefaultPort = (): MessagePort | null => {
    if (defaultPeerId) {
      return peerPortMap.get(defaultPeerId) ?? null;
    }
    return firstPort;
  };

  const bridge: ContextBridgeAPI = {
    _send: (data: unknown) => {
      const servicePath = getServicePath(data);
      const targetPort = servicePath ? servicePortMap.get(servicePath) : null;
      if (targetPort) {
        targetPort.postMessage(data);
      } else {
        const defaultPort = getDefaultPort();
        if (defaultPort) {
          defaultPort.postMessage(data);
        } else {
          realChannel.send(data);
        }
      }
    },
    _onMessage: (cb: (data: unknown) => void) => {
      messageHandlers.add(cb);
    },
    _offMessage: () => {
      messageHandlers.clear();
    },
  };

  const ipcBridge: ContextBridgeAPI = {
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

  ipcChannel.on((rawMessage: IpcLikeMessage) => {
    const data = rawMessage?.data ?? rawMessage;
    const ports = (rawMessage as IpcLikeMessage)?.ports ?? [];
    if (ports.length > 0) return;
    if (getServicePath(data) === ORCHESTRATOR_SERVICE_PATH) return;
    ipcMessageHandlers.forEach((cb) => cb(data));
  });

  try {
    contextBridge.exposeInMainWorld(bridgeKey, {
      _send: bridge._send,
      _onMessage: bridge._onMessage,
      _offMessage: bridge._offMessage,
    });
    contextBridge.exposeInMainWorld(ipcBridgeKey, {
      _send: ipcBridge._send,
      _onMessage: ipcBridge._onMessage,
      _offMessage: ipcBridge._offMessage,
    });
  } catch {
    console.warn(
      '[createPageBridge] contextBridge not available. ' +
        'Falling back to globalThis. This should only happen in tests.'
    );
    const g = globalThis as Record<string, unknown>;
    g[bridgeKey] = {
      _send: bridge._send,
      _onMessage: bridge._onMessage,
      _offMessage: bridge._offMessage,
    };
    g[ipcBridgeKey] = {
      _send: ipcBridge._send,
      _onMessage: ipcBridge._onMessage,
      _offMessage: ipcBridge._offMessage,
    };
  }

  return { channel: realChannel, ipcChannel };
}
