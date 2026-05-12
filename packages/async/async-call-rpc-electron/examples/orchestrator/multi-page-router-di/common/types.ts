export interface ISharedService {
  echo(msg: string): Promise<string>;
  getConfig(key: string): Promise<string>;
  setConfig(key: string, value: string): Promise<string>;
}

export const SHARED_SERVICE_PATH = 'shared-rpc';

export interface IDaemonService {
  echo(msg: string): Promise<string>;
  systemStatus(): Promise<string>;
}

export const DAEMON_SERVICE_PATH = 'daemon-rpc';

export interface IPageletService {
  info(): Promise<string>;
  callSharedEcho(msg: string): Promise<string>;
  callSharedGetConfig(key: string): Promise<string>;
  callSharedSetConfig(key: string, value: string): Promise<string>;
  callDaemonEcho(msg: string): Promise<string>;
  callDaemonSystemStatus(): Promise<string>;
  callMainPing(msg: string): Promise<string>;
}

export const PAGELET_SERVICE_PATH = 'pagelet-api';

export interface IMainRpcService {
  mainPing(msg: string): Promise<string>;
}

export const MAIN_RPC_SERVICE_PATH = 'main-rpc';

export interface IOrchestratorService {
  connect(pageId: string): Promise<any>;
  disconnect(pageId: string): Promise<void>;
  simulateLost(pageId: string): void;
  getStatus(pageId: string): Promise<any>;
  killUtility(pageId: string): void;
  onStateChange(callback: (event: any) => void): void;
  onReady(callback: (event: any) => void): void;
  onDisconnected(callback: (event: any) => void): void;
  onReconnecting(callback: (event: any) => void): void;
  onReconnected(callback: (event: any) => void): void;
  onReconnectFailed(callback: (event: any) => void): void;
  onClosed(callback: (event: any) => void): void;
}

export const ORCHESTRATOR_SERVICE_PATH = 'orchestrator';
