import ContextBridgeChannel from './ContextBridgeChannel';

export function createPageChannel(description?: string): ContextBridgeChannel {
  const channel = new ContextBridgeChannel({
    description: description ?? 'page-rpc',
  });
  channel.activate();
  return channel;
}
