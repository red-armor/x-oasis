export enum RequestType {
  /**
   * Normal request — waits for a single return value.
   */
  PromiseRequest = 'pr',
  PromiseAbort = 'pa',

  /**
   * Fire-and-forget command — no return value expected.
   */
  SignalRequest = 'sr',
  SignalAbort = 'sa',

  /**
   * Subscription request — expects a stream of values.
   * The server should keep sending `ReturnSuccess` until the
   * client sends a `SubscriptionStop`.
   */
  SubscriptionRequest = 'sub',

  /**
   * Stop an active subscription.
   */
  SubscriptionStop = 'unsub',

  /**
   * Stop an active ping-pong event method (on* method).
   * Similar to SubscriptionStop but for the simpler event method pattern.
   */
  EventMethodStop = 'evt-stop',
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

  /**
   * Indicates the subscription has been stopped by the server.
   */
  SubscriptionStopped = 'ss',

  /**
   * Indicates the event method (ping-pong) has been stopped.
   */
  EventMethodStopped = 'evt-stopped',
}
export type ResponseEntryHeader = [ResponseType, RequestSequenceId];
export type ResponseEntryBody = any;

export type HostName = string;

/**
 * 0 RequestType: PromiseRequest, PromiseAbort, SignalRequest, SignalAbort, SubscriptionRequest, SubscriptionStop, EventMethodStop
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

/**
 * An object that can be unsubscribed.
 * Returned by subscription-style calls.
 */
export interface Unsubscribable {
  unsubscribe(): void;
}
