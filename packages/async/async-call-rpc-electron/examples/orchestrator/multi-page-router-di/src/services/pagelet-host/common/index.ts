export const RENDERER_PARTICIPANT_ID = 'renderer';

export const CONNECTION_PARTICIPANT_ID = 'connection';

export const MONITOR_PARTICIPANT_ID = 'monitor';

export const PAGELET_SERVICE_PATH = 'pagelet-api';

export const MONITOR_PAGELET_SERVICE_PATH = 'monitor-pagelet-api';

export interface IPageletService {
  info(): Promise<string>;
  callSharedEcho(msg: string): Promise<string>;
  callSharedGetConfig(key: string): Promise<string>;
  callSharedSetConfig(key: string, value: string): Promise<string>;
  callDaemonEcho(msg: string): Promise<string>;
  callDaemonSystemStatus(): Promise<string>;
  callMainPing(msg: string): Promise<string>;
}

export interface IMonitorPageletService {
  info(): Promise<string>;
  getSnapshot(): Promise<any>;
  onPerformanceUpdate(callback: (snapshot: any) => void): () => void;
}

export const MAIN_RPC_SERVICE_PATH = 'main-rpc';

export interface IMainRpcService {
  mainPing(msg: string): Promise<string>;
}
