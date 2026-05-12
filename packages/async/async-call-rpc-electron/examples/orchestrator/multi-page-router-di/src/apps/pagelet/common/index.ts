export const RENDERER_PARTICIPANT_ID = 'renderer';

export const PAGELET_IDS = ['pagelet-A', 'pagelet-B', 'pagelet-C'];

export const PAGELET_SERVICE_PATH = 'pagelet-api';

export interface IPageletService {
  info(): Promise<string>;
  callSharedEcho(msg: string): Promise<string>;
  callSharedGetConfig(key: string): Promise<string>;
  callSharedSetConfig(key: string, value: string): Promise<string>;
  callDaemonEcho(msg: string): Promise<string>;
  callDaemonSystemStatus(): Promise<string>;
  callMainPing(msg: string): Promise<string>;
}

export const MAIN_RPC_SERVICE_PATH = 'main-rpc';

export interface IMainRpcService {
  mainPing(msg: string): Promise<string>;
}
