import { RequestType, ResponseType, DeserializedMessageOutput } from '../types';
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';
import { RPCError, JSONRPCErrorCode } from '../error';

export const handleResponse =
  (protocol: AbstractChannelProtocol) =>
  (message: DeserializedMessageOutput) => {
    if (!message) return message;
    const { data } = message;
    const header = data[0];
    const body = data[1];
    const type = header[0] as any;

    // Pass through if this is a request (not a response)
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
        // Wrap raw error into a structured RPCError
        const rawError = body[0];
        const rpcError = new RPCError({
          code: rawError?.code ?? JSONRPCErrorCode.InternalError,
          message: rawError?.message ?? 'Remote procedure call failed',
          data: rawError?.data,
        });
        findDefer.reject(rpcError);
      } else {
        findDefer.resolve(body[0]);
      }
    } else {
      // Event method callback (e.g. on* methods)
      const findListener = protocol.requestEvents.get(`${seqId}`);

      if (findListener) {
        findListener(...body);
      }
    }
    return null;
  };
