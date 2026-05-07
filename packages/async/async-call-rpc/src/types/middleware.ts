import { Deferred } from '@x-oasis/deferred';

import { HostRequestEntry, RequestEntry } from './rpc';

export type MiddlewareFunction = {
  (...args: any[]): any;
  displayName?: string;
  lifecycle?: SendMiddlewareLifecycle;
};

/**
 * Base message output from the channel's on() listener.
 *
 * All client-side middleware process messages through this structure.
 * Both raw and deserialized messages inherit from MessageOutput.
 *
 * ## ports field:
 *
 * Receiver-side equivalent of sender's transfer list.
 *
 * When a message is sent with Transferable objects (via transfer list),
 * those objects arrive in message.ports[].
 *
 * Example:
 * - Sender: endpoint.service.method({port: messagePort}) with transfer: [messagePort]
 * - Receiver: message.ports = [messagePort]
 *
 * The ports array is populated by:
 * 1. normalize middleware extracts from MessageEvent.ports
 * 2. Passed through deserialize middleware unchanged
 * 3. handleResponse middleware uses ports[0] for PortSuccess response type
 *
 * For most use cases, the framework handles ports automatically.
 * For custom middleware, check message.ports[0] if expecting Transferable objects.
 */
export type MessageOutput = {
  event: any;
  /**
   * Transferable objects received from the sender.
   * Typically contains MessagePort objects for port transfer scenarios.
   * Array is empty [] if no Transferables were sent.
   */
  ports: any[];
};

/**
 * Normalized raw message output from the channel.
 *
 * This is the first stage in the client-side middleware chain.
 * The data is still in raw string format, waiting for deserialize middleware.
 *
 * The ports field is populated by the normalize middleware from event.ports.
 */
export type NormalizedRawMessageOutput = MessageOutput & {
  data: string;
};

/**
 * Deserialized message output ready for business logic.
 *
 * This is after the deserialize middleware has decoded the data back to objects.
 * The ports field is preserved from NormalizedRawMessageOutput.
 *
 * The data field now contains the parsed RPC message: [header, body]
 * where header includes the message type (ResponseType or RequestType).
 *
 * handleResponse middleware uses this to route responses to requests
 * and handles Transferable objects from ports field.
 */
export type DeserializedMessageOutput = MessageOutput & {
  data: HostRequestEntry | RequestEntry;
};

export type SenderMiddlewareOutput = {
  data: any;
  transfer: any;
  seqId: number;
  returnValue: Deferred;
  isOptionsRequest: boolean;
  middlewareContext: MiddlewareContext;
};

export type PendingSendEntry = SenderMiddlewareOutput & {
  // fnName: string;
  methodName: string;
  lifecycle: SendMiddlewareLifecycle;
  middlewareContext: MiddlewareContext;
};

export type MiddlewareContext = {
  isResumed?: boolean;
  startLifecycle: SendMiddlewareLifecycle;
  minLifecycle: SendMiddlewareLifecycle;
  reserved: PendingSendEntry;
};

export enum SendMiddlewareLifecycle {
  Initial = 0,
  Prepare = 10,
  Transform = 20,
  DataOperation = 30,
  Send = 40,
  Aborted = 100,
}
