import ContextBridgeChannel from './ContextBridgeChannel';

export const IPC_BRIDGE_KEY = '__rpc_ipc_bridge__' as const;

export function createPageChannel(description?: string): ContextBridgeChannel {
  const channel = new ContextBridgeChannel({
    description: description ?? 'page-rpc',
  });
  channel.activate();
  return channel;
}

export function createIpcPageChannel(
  description?: string
): ContextBridgeChannel {
  const channel = new ContextBridgeChannel({
    description: description ?? 'page-ipc-rpc',
    bridgeKey: IPC_BRIDGE_KEY,
  });
  channel.activate();
  return channel;
}
