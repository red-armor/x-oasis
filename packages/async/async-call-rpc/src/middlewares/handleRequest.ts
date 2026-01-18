import isPromise from '@x-oasis/is-promise';
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

  // Fallback when no request context is available
  const { code, message, data } = mapper(error, {} as Request);
  return { code, message, data };
};

export const handleRequest =
  (protocol: AbstractChannelProtocol) =>
  (message: DeserializedMessageOutput) => {
    const service = protocol.service;

    const { data } = message;
    const header = data[0];

    const body = data[1];
    const type = header[0] as any;

    /**
     * if the message is a response, do nothing and return the message
     */
    if (Object.values(ResponseType).includes(type)) {
      return message;
    }

    const seqId = header[1];
    const requestPath = header[2];
    const methodName = header[3];
    const args = body[0];

    // Create JSONRPC request object for error context
    const jsonrpcRequest = makeRequest(seqId, methodName, args);

    const handler = service.getHandler(methodName);

    // Check if method exists
    if (!handler) {
      const errorResponse = ErrorResponseMethodNotFound(seqId);
      const responseHeader = [ResponseType.ReturnFail, seqId];
      const responseBody = [errorResponse.error];

      protocol.sendReply(
        protocol.writeBuffer.encode([responseHeader, responseBody])
      );
      return message;
    }

    const _result = handler(args);

    // todo
    const result = Promise.resolve(_result);

    if (isPromise(result)) {
      result.then(
        (response: any) => {
          const responseHeader = [ResponseType.ReturnSuccess, seqId];
          let responseBody = [];
          let sendData = null;
          try {
            responseBody = [response];
            sendData = protocol.writeBuffer.encode([
              responseHeader,
              responseBody,
            ]);
          } catch (err) {
            // Encoding error - use standardized error format
            const errorBody = createErrorResponseBody(err, jsonrpcRequest);
            responseBody = [errorBody];
            sendData = protocol.writeBuffer.encode([
              responseHeader,
              responseBody,
            ]);
            console.error(
              `[handleRequest sendReply encode error ] ${requestPath} ${methodName}`,
              err
            );
          }

          protocol.sendReply(sendData);
        },
        (err: unknown) => {
          // Use standardized JSONRPC error format
          const errorBody = createErrorResponseBody(err, jsonrpcRequest);
          const responseHeader = [ResponseType.ReturnFail, seqId];
          const responseBody = [errorBody];

          protocol.sendReply(
            protocol.writeBuffer.encode([responseHeader, responseBody])
          );
        }
      );
    }
    // 其实这儿不应该这么处理，应该返回一个空值，但是为了方便，还是返回原来的消息
    // 因为假如说是一个request的话，到这一步就算处理完了
    return message;
  };
