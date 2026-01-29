import RPCServiceHandler from './RPCServiceHost';

class RPCServiceProvider {
  private hostMap = new Map<string, RPCServiceHandler>();

  getHost(hostPath: string) {
    return this.hostMap.get(hostPath);
  }

  registerHost(hostPath: string) {
    const host = this.hostMap.get(hostPath);
    if (host) return host;
    this.hostMap.set(hostPath, new RPCServiceHandler(hostPath));
    return this.hostMap.get(hostPath);
  }

  resetHost(hostPath: string) {
    this.hostMap.set(hostPath, new RPCServiceHandler(hostPath));
  }
}

export default new RPCServiceProvider();
