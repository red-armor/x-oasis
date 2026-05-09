export interface OrchestratorAPIClient {
  connect: () => Promise<any>;
  disconnect: () => Promise<any>;
  simulateLost: () => Promise<any>;
  getStatus: () => Promise<any>;
  killUtility?: () => Promise<any>;
  onStateChange: (callback: (event: any) => void) => {
    unsubscribe: () => void;
  };
  onReady: (callback: (event: any) => void) => { unsubscribe: () => void };
  onDisconnected: (callback: (event: any) => void) => {
    unsubscribe: () => void;
  };
  onReconnecting: (callback: (event: any) => void) => {
    unsubscribe: () => void;
  };
  onReconnected: (callback: (event: any) => void) => {
    unsubscribe: () => void;
  };
  onReconnectFailed: (callback: (event: any) => void) => {
    unsubscribe: () => void;
  };
  onClosed: (callback: (event: any) => void) => { unsubscribe: () => void };
}

export interface OrchestratorAPIOverrides {
  sendRpc?: (message: string) => Promise<any>;
  killUtility?: () => Promise<any>;
}

export function createOrchestratorAPI(
  orchestratorClient: any,
  overrides?: OrchestratorAPIOverrides
) {
  const unwrap = (method: string, callback: (event: any) => void) => {
    const { unsubscribe } = orchestratorClient[method](callback);
    return unsubscribe;
  };

  const api: Record<string, any> = {
    connect: () => orchestratorClient.connect(),
    disconnect: () => orchestratorClient.disconnect(),
    simulateLost: () => orchestratorClient.simulateLost(),
    getStatus: () => orchestratorClient.getStatus(),
    onStateChange: (cb: any) => unwrap('onStateChange', cb),
    onReady: (cb: any) => unwrap('onReady', cb),
    onDisconnected: (cb: any) => unwrap('onDisconnected', cb),
    onReconnecting: (cb: any) => unwrap('onReconnecting', cb),
    onReconnected: (cb: any) => unwrap('onReconnected', cb),
    onReconnectFailed: (cb: any) => unwrap('onReconnectFailed', cb),
    onClosed: (cb: any) => unwrap('onClosed', cb),
  };

  if (overrides?.sendRpc) {
    api.sendRpc = overrides.sendRpc;
  }
  if (overrides?.killUtility) {
    api.killUtility = overrides.killUtility;
  }

  return api;
}
