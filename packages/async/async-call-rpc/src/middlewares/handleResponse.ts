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

    // Handle SubscriptionStopped — the server ended a subscription
    if (type === ResponseType.SubscriptionStopped) {
      const sub = protocol.subscriptions.get(`${seqId}`);
      if (sub) {
        // The server-side subscription is done; clean up client-side tracking
        protocol.subscriptions.delete(`${seqId}`);
      }
      // Also notify any subscription listener
      const listener = protocol.requestEvents.get(`${seqId}`);
      if (listener && typeof listener._onComplete === 'function') {
        listener._onComplete();
      }
      protocol.requestEvents.delete(`${seqId}`);
      return null;
    }

    const findDefer = protocol.ongoingRequests.get(`${seqId}`);

    if (findDefer) {
      // Check if this deferred is for a subscription (has _isSubscription flag)
      const isSubscription = (findDefer as any)._isSubscription;

      if (isSubscription) {
        // For subscriptions, don't delete the deferred — stream continues.
        // Route data to the subscription listener instead.
        if (type === ResponseType.ReturnFail) {
          const rawError = body[0];
          const rpcError = new RPCError({
            code: rawError?.code ?? JSONRPCErrorCode.InternalError,
            message: rawError?.message ?? 'Remote procedure call failed',
            data: rawError?.data,
          });
          // Subscription error — clean up and reject
          protocol.ongoingRequests.delete(`${seqId}`);
          findDefer.reject(rpcError);
        } else if (type === ResponseType.ReturnSuccess) {
          // Subscription data — notify via the event listener
          const listener = protocol.requestEvents.get(`${seqId}`);
          if (listener && typeof listener === 'function') {
            listener(body[0]);
          }
        }
      } else {
        // Normal one-shot request
        protocol.ongoingRequests.delete(`${seqId}`);
        // 说明函数调用返回的是一个 MessagePort, 它一般是用来 client.acquirePort()
        if (type === ResponseType.PortSuccess) {
          console.log('testing-------', message, message.ports[0]);
          findDefer.resolve(message.ports[0]);
        } else if (type === ResponseType.ReturnFail) {
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
      }
    } else {
      // Event method callback (e.g. on* methods) or subscription data
      const findListener = protocol.requestEvents.get(`${seqId}`);

      if (findListener) {
        if (typeof findListener === 'function') {
          findListener(...body);
        } else if (typeof findListener._onData === 'function') {
          // Structured subscription listener
          if (type === ResponseType.ReturnFail) {
            const rawError = body[0];
            const rpcError = new RPCError({
              code: rawError?.code ?? JSONRPCErrorCode.InternalError,
              message: rawError?.message ?? 'Remote procedure call failed',
              data: rawError?.data,
            });
            findListener._onError?.(rpcError);
          } else {
            findListener._onData(body[0]);
          }
        }
      }
    }
    return null;
  };
