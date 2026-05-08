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

  /**
   * Promise request with all args as Transferable objects.
   *
   * When args contain ONLY Transferable objects (MessagePort, ArrayBuffer, etc.)
   * and NO serializable data, use this request type. This allows the receiver to
   * reconstruct args from message.ports without any data deserialization.
   *
   * Constraint: args must be ALL Transferables or ALL serializable data.
   * Mixing Transferables with serializable data is NOT allowed and will raise an error.
   *
   * Example:
   *   // ✅ Valid: args = [port1, port2]
   *   await endpoint.service.methodName(port1, port2); // auto-detected as TransferableArgsRequest
   *
   *   // ❌ Invalid: args = [{port: port1}, callback]  (mixing Transferable and serializable)
   *   // This will raise an error during validation in prepareNormalData middleware
   */
  TransferableArgsRequest = 'tar',

  /**
   * Promise request with a single Transferable arg wrapped in an array.
   *
   * Same as TransferableArgsRequest but signals that the original call had
   * multiple Transferable args (e.g. `service.process(port1, port2)`).
   * The receiver passes the full `message.ports` array to the handler.
   *
   * Distinction:
   *   - TransferableArgsRequest  → single arg:   handler(ports[0])
   *   - TransferableArrayArgsRequest → array args: handler(ports)
   */
  TransferableArrayArgsRequest = 'taar',
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

  /**
   * Handler returned a single Transferable (e.g. `return port`).
   * Receiver resolves with `message.ports[0]`.
   */
  PortSuccess = 'ps',
  PortFail = 'pf',

  /**
   * Handler returned an array of Transferables (e.g. `return [port1, port2]`).
   * Receiver resolves with the full `message.ports` array.
   */
  PortArraySuccess = 'pas',

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
