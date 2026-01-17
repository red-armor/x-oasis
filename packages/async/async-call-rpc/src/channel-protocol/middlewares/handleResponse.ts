import {
  RequestType,
  ResponseType,
  DeserializedMessageOutput,
} from '../../types';
import AbstractChannelProtocol from '../AbstractChannelProtocol';

export const handleResponse =
  (protocol: AbstractChannelProtocol) =>
  (message: DeserializedMessageOutput) => {
    if (!message) return message;
    const { data } = message;
    const header = data[0];
    const body = data[1];
    const type = header[0] as any;

    if (Object.values(RequestType).includes(type)) {
      return message;
    }

    const seqId = header[1];

    const findDefer = protocol.ongoingRequests.get(`${seqId}`);
    if (findDefer) {
      protocol.ongoingRequests.delete(`${seqId}`);
      if (type === ResponseType.PortSuccess) {
        findDefer.resolve(message.ports[0]);
      } else if (type === ResponseType.ReturnFail) {
        findDefer.reject(body[0]);
      } else findDefer.resolve(body[0]);
      return;
    }
    const findListener = protocol.requestEvents.get(`${seqId}`);

    if (findListener) {
      findListener(...body);
    }
  };
