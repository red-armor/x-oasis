import { ResponseType, DeserializedMessageOutput } from '../types';
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

    const result = handler(args);

    // Normalize to Promise for uniform handling
    Promise.resolve(result).then(
      (response: any) => {
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
      },
      (err: unknown) => {
        const errorBody = createErrorResponseBody(err, jsonrpcRequest);
        const responseHeader = [ResponseType.ReturnFail, seqId];
        const responseBody = [errorBody];

        safeSendReply(
          protocol,
          protocol.writeBuffer.encode([responseHeader, responseBody])
        );
      }
    );

    return message;
  };
