import ProxyRPCClient from './ProxyRPCClient';
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';

class RPCClientHost {
  private hostMap = new Map<string, ProxyRPCClient>();

  registerClient(
    requestPath: string,
    options?: {
      channel?: AbstractChannelProtocol;
    }
  ) {
    const client = new ProxyRPCClient(requestPath, options);
    this.hostMap.set(requestPath, client);
    return client;
  }

  getClient(requestPath: string): ProxyRPCClient | undefined {
    return this.hostMap.get(requestPath);
  }

  removeClient(requestPath: string): boolean {
    return this.hostMap.delete(requestPath);
  }
}

export { RPCClientHost };
export default new RPCClientHost();
