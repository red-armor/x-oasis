import isPromise from '@x-oasis/is-promise';
import { ResponseType, DeserializedMessageOutput } from '../types';
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';

export const handleRequest =
  (protocol: AbstractChannelProtocol) =>
  (message: DeserializedMessageOutput) => {
    const service = protocol.service;

    const { data, event: messageEvent } = message;
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

    const handler = service.getHandler(methodName);

    const _result = handler?.(args);

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
            sendData = protocol.writeBuffer.encode([responseHeader, []]);
            console.error(
              `[handleRequest sendReply encode error ] ${requestPath} ${methodName}`,
              err
            );
          }

          protocol.sendReply(sendData);
        },
        (err: Error) => {
          const responseHeader = [ResponseType.ReturnFail, seqId];
          const responseBody = [
            {
              message: err.message,
              name: err.name,
              // eslint-disable-next-line
              stack: err.stack
                ? err.stack.split
                  ? err.stack.split('\n')
                  : err.stack
                : undefined,
            },
          ];

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
