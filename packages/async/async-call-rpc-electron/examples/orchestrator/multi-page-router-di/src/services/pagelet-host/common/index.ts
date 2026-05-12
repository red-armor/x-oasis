export const RENDERER_PARTICIPANT_ID = 'renderer';

export const CONNECTION_PARTICIPANT_ID = 'connection';

export const PAGELET_SERVICE_PATH = 'pagelet-api';

export interface IPageletService {
  info(): Promise<string>;
  callSharedEcho(msg: string): Promise<string>;
  callSharedGetConfig(key: string): Promise<string>;
  callSharedSetConfig(key: string, value: string): Promise<string>;
  callDaemonEcho(msg: string): Promise<string>;
  callDaemonSystemStatus(): Promise<string>;
  callMainPing(msg: string): Promise<string>;
  callMonitorGetSnapshot(): Promise<any>;
  onMonitorPerformanceUpdate(callback: (snapshot: any) => void): () => void;
}

export const MAIN_RPC_SERVICE_PATH = 'main-rpc';

export interface IMainRpcService {
  mainPing(msg: string): Promise<string>;
}
