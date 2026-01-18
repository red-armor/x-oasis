import { Deferred } from '@x-oasis/deferred';

import { HostRequestEntry, RequestEntry } from './rpc';

export type MiddlewareFunction = {
  (...args: any[]): any;
  displayName?: string;
  lifecycle?: SendMiddlewareLifecycle;
};

export type MessageOutput = {
  event: any;
  ports: any;
};

export type NormalizedRawMessageOutput = MessageOutput & {
  data: string;
};

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
  fnName: string;
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
