import isPromise from '@x-oasis/is-promise';
import { ResponseType, DeserializedMessageOutput } from '../types';
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';
import { isEventMethod } from '../common';
import {
  defaultErrorMapper,
  ErrorResponseMapped,
  makeRequest,
} from '../utils/jsonrpc';
import { JSONRPCErrorCode } from '../error';

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
      if (isEventMethod(methodName)) {
        // const event = serviceHost.getHandler(requestPath, methodName)
        // const fn = (...args: any[]) => {
        //   const responseHeader = [ResponseType.ReturnSuccess, seqId]
        //   let responseBody = []
        //   let sendData = null
        //   try {
        //     responseBody = args
        //     sendData = protocol.writeBuffer.encode([responseHeader, responseBody])
        //   } catch (err) {
        //     sendData = protocol.writeBuffer.encode([responseHeader, []])
        //     console.error(`[handleRequest sendReply encode error ] ${requestPath} ${methodName}`, err)
        //   }

        //   // TODO: temp; main <=> project renderer...
        //   if (messageEvent?.sender) {
        //     messageEvent.sender.send(channelName, sendData)
        //     return
        //   }

        //   protocol.sendReply(sendData)
        // }

        // event(fn)
        return message;
      }

      const handler = serviceHost.getHandler(methodName);

      // Create JSONRPC request object for error context
      const jsonrpcRequest = makeRequest(seqId, methodName, args);

      // todo
      const result = Promise.resolve(handler?.(args));

      if (handler && isPromise(result)) {
        result.then(
          (port: any) => {
            const responseHeader = [ResponseType.PortSuccess, seqId];
            let responseBody: any[] = [];
            let sendData = null;
            try {
              responseBody = [];
              sendData = protocol.writeBuffer.encode([
                responseHeader,
                responseBody,
              ]);
            } catch (err) {
              // Encoding error - use standardized error format
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
                `[handleRequest sendReply encode error ] ${requestPath} ${methodName}`,
                err
              );
            }

            // TODO: temp; main <=> project renderer...
            if (messageEvent?.sender) {
              messageEvent.sender.postMessage(channelName, sendData, [port]);
              return;
            }

            protocol.sendReply(sendData);
          },
          (err: unknown) => {
            // Use standardized JSONRPC error format
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
    }
    return message;
  };
