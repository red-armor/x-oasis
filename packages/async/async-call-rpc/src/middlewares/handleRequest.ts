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

export const handleRequest =
  (protocol: AbstractChannelProtocol) =>
  (message: DeserializedMessageOutput) => {
    const service = protocol.service;

    const { data } = message;
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
    const args = body[0];

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

    const handler = service.getHandler(methodName);

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
        } catch (err: unknown) {
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
      } catch (err: unknown) {
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
