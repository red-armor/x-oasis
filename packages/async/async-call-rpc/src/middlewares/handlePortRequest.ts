import { ResponseType, DeserializedMessageOutput } from '../types';
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';
import { isEventMethod } from '../common';
import {
  defaultErrorMapper,
  ErrorResponseMapped,
  makeRequest,
} from '../utils/jsonrpc';
import { JSONRPCErrorCode } from '../error';

/**
 * Middleware for handling port-based (MessagePort) requests.
 *
 * Used in Electron/MessageChannel scenarios where the response
 * must be sent back through `event.sender` and may include a
 * `MessagePort` transfer.
 */
export const handlePortRequest =
  (protocol: AbstractChannelProtocol) =>
  (message: DeserializedMessageOutput) => {
    const serviceHost = protocol.service;

    const { data, event: messageEvent } = message;
    const header = data[0];
    const channelName = header[4];

    const body = data[1];
    const type = header[0] as any;

    if (Object.values(ResponseType).includes(type)) {
      return message;
    }

    const seqId = header[1];
    const requestPath = header[2];
    const methodName = header[3];
    const args = body[0];

    if (serviceHost) {
      // Event methods (on*) are handled by subscription protocol; skip here
      if (isEventMethod(methodName)) {
        return message;
      }

      const handler = serviceHost.getHandler(methodName);
      const jsonrpcRequest = makeRequest(seqId, methodName, args);

      if (!handler) return message;

      Promise.resolve(handler(args)).then(
        (port: any) => {
          const responseHeader = [ResponseType.PortSuccess, seqId];
          let responseBody: any[] = [];
          let sendData = null;
          try {
            sendData = protocol.writeBuffer.encode([
              responseHeader,
              responseBody,
            ]);
          } catch (err) {
            const mapper = defaultErrorMapper(
              err instanceof Error ? err.stack : '',
              JSONRPCErrorCode.InternalError
            );
            const errorResponse = ErrorResponseMapped(
              jsonrpcRequest,
              err,
              mapper
            );
            responseBody = [errorResponse.error];
            sendData = protocol.writeBuffer.encode([
              responseHeader,
              responseBody,
            ]);
            console.error(
              `[handlePortRequest] Encode error for ${requestPath}.${methodName}:`,
              err
            );
          }

          // Route response through event.sender if available (Electron IPC)
          if (messageEvent?.sender) {
            messageEvent.sender.postMessage(channelName, sendData, [port]);
            return;
          }

          protocol.sendReply(sendData);
        },
        (err: unknown) => {
          const mapper = defaultErrorMapper(
            err instanceof Error ? err.stack : '',
            JSONRPCErrorCode.InternalError
          );
          const errorResponse = ErrorResponseMapped(
            jsonrpcRequest,
            err,
            mapper
          );
          const responseHeader = [ResponseType.ReturnFail, seqId];
          const responseBody = [errorResponse.error];

          if (messageEvent?.sender) {
            messageEvent.sender.send(
              (protocol as any).channelName,
              protocol.writeBuffer.encode([responseHeader, responseBody])
            );
            return;
          }

          protocol.sendReply(
            protocol.writeBuffer.encode([responseHeader, responseBody])
          );
        }
      );
    }
    return message;
  };
