export enum RequestType {
  /**
   * for normal request, wait for return value
   */
  PromiseRequest = 'pr',
  PromiseAbort = 'pa',

  /**
   * send a command
   */
  SignalRequest = 'sr',
  SignalAbort = 'sa',
}

export type RequestRawSequenceId = number;

export type RequestSequenceId = string;
export type RequestServicePath = string;
export type RequestFnName = string;

export type RequestEntryHeader = [
  RequestType,
  RequestSequenceId,
  RequestServicePath,
  RequestFnName
];
export type RequestEntryBody = any;
export type RequestEntry = [RequestEntryHeader, RequestEntryBody];

export enum ResponseType {
  ReturnSuccess = 'rs',
  ReturnFail = 'rf',

  PortSuccess = 'ps',
  PortFail = 'pf',
}
export type ResponseEntryHeader = [ResponseType, RequestSequenceId];
export type ResponseEntryBody = any;

export type HostName = string;

/**
 * 0 RequestType: PromiseRequest, PromiseAbort, SignalRequest, SignalAbort
 * 1 RequestSequenceId: string
 */
export type HostRequestEntryHeader = [
  RequestType,
  RequestSequenceId,
  RequestServicePath,
  RequestFnName,
  HostName
];
export type HostRequestEntryBody = any;
export type HostRequestEntry = [HostRequestEntryHeader, HostRequestEntryBody];

export type SendingProps = {
  requestPath?: string;
  fnName?: string;
  args?: any;
  isOptionsRequest?: boolean;
};
