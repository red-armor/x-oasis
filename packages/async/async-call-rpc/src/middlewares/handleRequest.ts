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
    let args = body[0];

    // ✨ SPECIAL HANDLING: TransferableArgsRequest
    // When all args are Transferable objects (MessagePort, ArrayBuffer, etc.),
    // they are passed via the transfer list (message.ports) instead of data.
    // Here we reconstruct args from message.ports.
    //
    // Example: client sends { requestPath: 'Service', methodName: 'method', args: [port1, port2] }
    // - Message.ports will contain [port1, port2]
    // - body[0] (args) will be empty or minimal
    // - We need to convert message.ports into args for the handler
    if (type === RequestType.TransferableArgsRequest) {
      // Reconstruct args from message.ports
      // Each port in message.ports becomes an element in args
      args = ports || [];

      console.debug(
        `[handleRequest] TransferableArgsRequest: reconstructed ${args.length} args from message.ports`
      );
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

    // Multi-service routing: prefer host lookup (by requestPath + methodName)
    // when a serviceHost is bound to this channel. If the host doesn't know
    // this requestPath, silently no-op — multiple channels may share one
    // transport, and this avoids cross-talk "Method not found" replies.
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
          const result = ctx !== undefined ? handler(args, ctx) : handler(args);
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

      const result = ctx !== undefined ? handler(args, ctx) : handler(args);

      try {
        const response = await Promise.resolve(result);

        // Port return value: encode as PortSuccess and pass the port as a
        // transferable. The receiving side's `handleResponse` resolves the
        // deferred with `message.ports[0]`.
        if (isPortLike(response)) {
          const portHeader = [ResponseType.PortSuccess, seqId];
          const sendData = protocol.writeBuffer.encode([portHeader, []]);
          if (protocol.isConnected()) {
            (protocol.sendReply as (d: any, t?: any[]) => void)(
              sendData,
              [].concat(response)
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
