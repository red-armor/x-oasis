import { ResponseType, RequestType, DeserializedMessageOutput } from '../types';
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';
import {
  ErrorResponseMethodNotFound,
  defaultErrorMapper,
  ErrorResponseMapped,
  makeRequest,
  Request,
  AsyncCallErrorDetail,
} from '../utils/jsonrpc';
import { JSONRPCErrorCode } from '../error';
import { isEventMethod } from '../common';

/**
 * Create standardized error response body
 */
const createErrorResponseBody = (
  error: unknown,
  request?: Request
): {
  code: number;
  message: string;
  data?: AsyncCallErrorDetail;
} => {
  const mapper = defaultErrorMapper(
    error instanceof Error ? error.stack : '',
    JSONRPCErrorCode.InternalError
  );

  if (request) {
    const errorResponse = ErrorResponseMapped(request, error, mapper);
    return errorResponse.error;
  }

  const { code, message, data } = mapper(error, {} as Request);
  return { code, message, data };
};

/**
 * Safely send a reply through the protocol, checking connection state first.
 * Mirrors electron-trpc's `event.sender.isDestroyed()` pattern.
 */
const safeSendReply = (protocol: AbstractChannelProtocol, data: any): void => {
  if (!protocol.isConnected()) {
    return;
  }
  protocol.sendReply(data);
};

/**
 * Detect a MessagePort-like return value (Web `MessagePort`, Electron
 * `MessagePortMain`, or any duck-typed equivalent). Such values must be
 * transferred via the channel's transfer list rather than serialized.
 */
const isPortLike = (_v: any): boolean => {
  let v = _v;
  if (Array.isArray(_v)) {
    v = _v[0];
  }
  return (
    !!v && typeof v === 'object' && typeof (v as any).postMessage === 'function'
  );
};

export const handleRequest =
  (protocol: AbstractChannelProtocol) =>
  (message: DeserializedMessageOutput) => {
    const service = protocol.service;
    const serviceHost = protocol.serviceHost;

    const { data, ports } = message;
    const header = data[0];
    const body = data[1];
    const type = header[0] as any;

    // If the message is a response, pass through to the next middleware
    if (Object.values(ResponseType).includes(type)) {
      return message;
    }

    const seqId = header[1];
    const requestPath = header[2];
    const methodName = header[3];
    // Sender writes the full positional arg list as `body = params` (an array)
    // — see `prepareRequestData.ts`. Receive the whole array; the
    // Promise/Subscription dispatch path below spreads it back into the
    // handler's positional params. The previous `body[0]` only kept the
    // first arg, which silently broke any multi-arg handler (concrete repro:
    // OrchestratorInspectorService.requestConnect(fromId, toId) saw
    // toId === undefined, then BaseConnectionOrchestrator.connect threw
    // 'Unknown participant: "undefined"').
    let args: any = body;

    // ✨ SPECIAL HANDLING: Transferable args
    // Transferable objects travel via message.ports, not in the serialized body.
    // The RequestType tells us the original argument shape:
    //   - TransferableArgsRequest       → single arg:  handler(ports[0])
    //   - TransferableArrayArgsRequest  → array args:  handler(ports)
    if (type === RequestType.TransferableArgsRequest) {
      args = (ports || [])[0];
    } else if (type === RequestType.TransferableArrayArgsRequest) {
      args = ports || [];
    }

    const jsonrpcRequest = makeRequest(seqId, methodName, args);

    // Handle SubscriptionStop — cancel an active subscription
    if (type === RequestType.SubscriptionStop) {
      const sub = protocol.subscriptions.get(seqId);
      if (sub) {
        sub.unsubscribe();
        protocol.subscriptions.delete(seqId);
      }
      // Send SubscriptionStopped acknowledgement
      safeSendReply(
        protocol,
        protocol.writeBuffer.encode([
          [ResponseType.SubscriptionStopped, seqId],
          [],
        ])
      );
      return message;
    }

    // Handle EventMethodStop — cancel an active ping-pong event method listener
    if (type === RequestType.EventMethodStop) {
      // Mark this event method as inactive so remoteCallback stops sending
      protocol.activeEventMethods.delete(seqId);
      // Clean up the client's callback reference
      protocol.requestEvents.delete(seqId);
      // Send EventMethodStopped acknowledgement
      safeSendReply(
        protocol,
        protocol.writeBuffer.encode([
          [ResponseType.EventMethodStopped, seqId],
          [],
        ])
      );
      return message;
    }

    // -------------------------------------------------------------------
    // Routing priority contract (do not change without coordinating callers):
    //
    //   1. If `serviceHost` is bound, look up via host(requestPath, methodName).
    //      Unknown requestPath → silently drop (no error response, no
    //      fallback to `service`). This avoids cross-talk "Method not found"
    //      replies when one transport is shared by many channels.
    //   2. Otherwise, look up via service.getHandler(methodName) — single
    //      service mode, requestPath is ignored.
    //
    // Asymmetry is intentional: setting a serviceHost on a channel that
    // also has a channel-bound service makes the service unreachable.
    // See AbstractChannelProtocol.setService / setServiceHost JSDoc for
    // the developer-facing trap (orchestrator handshake hang, fixed in
    // commit 2d8648c by using a dedicated control channel).
    // -------------------------------------------------------------------
    let handler: ((...a: any[]) => any) | undefined;
    if (serviceHost) {
      handler = serviceHost.getHandler(requestPath, methodName);
      if (!handler) return message;
    } else {
      handler = service?.getHandler(methodName);
      if (!handler) {
        const errorResponse = ErrorResponseMethodNotFound(seqId);
        const responseHeader = [ResponseType.ReturnFail, seqId];
        const responseBody = [errorResponse.error];

        safeSendReply(
          protocol,
          protocol.writeBuffer.encode([responseHeader, responseBody])
        );
        return message;
      }
    }

    /**
     * Handle ping-pong event methods (on* methods).
     *
     * Ping-pong is a simple listen & fire pattern, distinct from streaming subscriptions:
     * - Client registers a callback via createProxy().onMethod(callback)
     * - Server calls the callback whenever it has data to send
     * - Client can later send EventMethodStop to cancel the listener
     *
     * The callback function is wrapped in a "remote callback" that serializes
     * and sends responses back to the client through the protocol. The server
     * tracks active listeners using activeEventMethods set, allowing graceful
     * cleanup when the client unsubscribes.
     *
     * Example:
     *   Service: onPing(callback) { setInterval(() => callback('ping'), 1000); }
     *   Client:  const unsub = client.onPing((data) => console.log(data));
     *            // Later: unsub(); // Stop listening
     */
    if (isEventMethod(methodName)) {
      // Register this event method as active.
      // The client can later send EventMethodStop to deactivate it.
      protocol.activeEventMethods.add(seqId);

      // Create a remote callback function that the handler can invoke.
      // Each invocation sends a ReturnSuccess response to the client.
      // Before sending, check if this listener is still active (not cancelled by client).
      const remoteCallback = (...callbackArgs: any[]) => {
        // Skip if client has already cancelled this listener via EventMethodStop
        if (!protocol.activeEventMethods.has(seqId)) {
          return;
        }

        const responseHeader = [ResponseType.ReturnSuccess, seqId];
        let sendData: any = null;

        try {
          // Encode the callback arguments as the response body
          sendData = protocol.writeBuffer.encode([
            responseHeader,
            callbackArgs.length === 1 ? [callbackArgs[0]] : callbackArgs,
          ]);
        } catch (err) {
          // If encoding fails, send empty response and log the error
          sendData = protocol.writeBuffer.encode([responseHeader, []]);
          console.error(
            `[handleRequest] Encode error for ${requestPath}.${methodName}:`,
            err
          );
        }

        safeSendReply(protocol, sendData);
      };

      // Invoke the handler with the remote callback.
      // The handler is expected to call remoteCallback(...) whenever it wants to send data.
      try {
        handler(remoteCallback);
      } catch (err) {
        // If handler throws during initialization, send error response and clean up
        protocol.activeEventMethods.delete(seqId);
        protocol.requestEvents.delete(seqId);

        const errorBody = createErrorResponseBody(err, jsonrpcRequest);
        safeSendReply(
          protocol,
          protocol.writeBuffer.encode([
            [ResponseType.ReturnFail, seqId],
            [errorBody],
          ])
        );
      }

      return message;
    }

    /**
     * Resolve per-request context if `createContext` is configured.
     */
    const resolveContext = async (): Promise<
      Record<string, unknown> | undefined
    > => {
      if (!protocol.createContext) return undefined;
      return protocol.createContext({
        event: message.event ?? null,
        requestPath,
        methodName,
      });
    };

    // Handle SubscriptionRequest — start a streaming subscription
    if (type === RequestType.SubscriptionRequest) {
      const startSubscription = async () => {
        let ctx: Record<string, unknown> | undefined;
        try {
          ctx = await resolveContext();
        } catch (err) {
          const errorBody = createErrorResponseBody(err, jsonrpcRequest);
          safeSendReply(
            protocol,
            protocol.writeBuffer.encode([
              [ResponseType.ReturnFail, seqId],
              [errorBody],
            ])
          );
          return;
        }

        try {
          // Spread positional args (matches client-side ProxyRPCClient which
          // sends args as an array of positional values). Context is appended
          // as a trailing argument when present, mirroring the convention used
          // by tRPC and other RPC frameworks. Single-arg unwrap for special
          // request types (Transferable*) was already done above by reassigning
          // `args`; for Promise/Subscription requests, `args` is always an array.
          const argList = Array.isArray(args) ? args : [args];
          const result =
            ctx !== undefined ? handler(...argList, ctx) : handler(...argList);
          const observable = await Promise.resolve(result);

          // The handler should return an observable-like object with `subscribe()`
          if (
            observable &&
            typeof observable === 'object' &&
            typeof observable.subscribe === 'function'
          ) {
            const subscription = observable.subscribe({
              next: (value: any) => {
                safeSendReply(
                  protocol,
                  protocol.writeBuffer.encode([
                    [ResponseType.ReturnSuccess, seqId],
                    [value],
                  ])
                );
              },
              error: (err: unknown) => {
                const errorBody = createErrorResponseBody(err, jsonrpcRequest);
                safeSendReply(
                  protocol,
                  protocol.writeBuffer.encode([
                    [ResponseType.ReturnFail, seqId],
                    [errorBody],
                  ])
                );
                protocol.subscriptions.delete(seqId);
              },
              complete: () => {
                safeSendReply(
                  protocol,
                  protocol.writeBuffer.encode([
                    [ResponseType.SubscriptionStopped, seqId],
                    [],
                  ])
                );
                protocol.subscriptions.delete(seqId);
              },
            });

            // Track the subscription for lifecycle cleanup
            protocol.subscriptions.set(seqId, subscription);
          } else {
            // Handler returned a non-observable — treat as single-value response
            safeSendReply(
              protocol,
              protocol.writeBuffer.encode([
                [ResponseType.ReturnSuccess, seqId],
                [observable],
              ])
            );
          }
        } catch (err) {
          const errorBody = createErrorResponseBody(err, jsonrpcRequest);
          safeSendReply(
            protocol,
            protocol.writeBuffer.encode([
              [ResponseType.ReturnFail, seqId],
              [errorBody],
            ])
          );
        }
      };

      startSubscription();
      return message;
    }

    /**
     * Normal request — invoke handler, optionally with context.
     */
    const invokeHandler = async () => {
      let ctx: Record<string, unknown> | undefined;
      try {
        ctx = await resolveContext();
      } catch (err) {
        const errorBody = createErrorResponseBody(err, jsonrpcRequest);
        safeSendReply(
          protocol,
          protocol.writeBuffer.encode([
            [ResponseType.ReturnFail, seqId],
            [errorBody],
          ])
        );
        return;
      }

      // Promise/regular request → spread positional args (matches client-side
      // ProxyRPCClient which sends args as an array of positional values).
      // Transferable* requests reassigned `args` above to the raw port(s); the
      // historical behavior is single-arg invocation (handler(port) or
      // handler([port1, port2])) — preserve that by only spreading when the
      // wire format is the array body of a Promise request.
      const isTransferable =
        type === RequestType.TransferableArgsRequest ||
        type === RequestType.TransferableArrayArgsRequest;
      let result: unknown;
      if (isTransferable) {
        result = ctx !== undefined ? handler(args, ctx) : handler(args);
      } else {
        const argList = Array.isArray(args) ? args : [args];
        result =
          ctx !== undefined ? handler(...argList, ctx) : handler(...argList);
      }

      try {
        const response = await Promise.resolve(result);

        // Port return value: encode as PortSuccess and pass the port(s) as
        // transferable(s). We record whether the original return value was an
        // array so the receiving side's `handleResponse` can faithfully restore
        // the same shape:
        //   - handler returns `port`      → client resolves with `port`
        //   - handler returns `[p1, p2]`  → client resolves with `[p1, p2]`
        if (isPortLike(response)) {
          // Distinguish single port vs array of ports via ResponseType:
          //   - PortSuccess      → client resolves with ports[0]
          //   - PortArraySuccess → client resolves with ports
          const responseType = Array.isArray(response)
            ? ResponseType.PortArraySuccess
            : ResponseType.PortSuccess;
          const portHeader = [responseType, seqId];
          const sendData = protocol.writeBuffer.encode([portHeader, []]);
          if (protocol.isConnected()) {
            (protocol.sendReply as (d: any, t?: any[]) => void)(
              sendData,
              Array.isArray(response) ? response : [response]
            );
          }
          return;
        }

        const responseHeader = [ResponseType.ReturnSuccess, seqId];
        let sendData = null;
        try {
          sendData = protocol.writeBuffer.encode([responseHeader, [response]]);
        } catch (err) {
          const errorBody = createErrorResponseBody(err, jsonrpcRequest);
          sendData = protocol.writeBuffer.encode([
            [ResponseType.ReturnFail, seqId],
            [errorBody],
          ]);
          console.error(
            `[handleRequest] Encode error for ${requestPath}.${methodName}:`,
            err
          );
        }

        safeSendReply(protocol, sendData);
      } catch (err) {
        const errorBody = createErrorResponseBody(err, jsonrpcRequest);
        const responseHeader = [ResponseType.ReturnFail, seqId];
        const responseBody = [errorBody];

        safeSendReply(
          protocol,
          protocol.writeBuffer.encode([responseHeader, responseBody])
        );
      }
    };

    invokeHandler();

    return message;
  };
