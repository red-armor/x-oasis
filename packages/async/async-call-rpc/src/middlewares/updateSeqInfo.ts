import { createDeferred } from '@x-oasis/deferred';
import { isEventMethod } from '../common';
import { SenderMiddlewareOutput, SendMiddlewareLifecycle } from '../types';
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';

/**
 * Update sequence information for request tracking and response handling.
 *
 * This middleware handles two scenarios:
 * 1. Event methods (on*): Store the callback and reset body to prevent serialization
 * 2. Regular methods: Create a deferred for response handling
 *
 * @param channelProtocol - The channel protocol instance
 * @returns Middleware function that updates sequence tracking
 */
export const updateSeqInfo = (channelProtocol: AbstractChannelProtocol) => {
  const fn = (value: SenderMiddlewareOutput) => {
    const { data, seqId } = value;
    const header = data[0];
    const body = data[1];
    const methodName = header[3];

    if (methodName && isEventMethod(methodName)) {
      // Event method: Store callback and clear body (avoid serializing the function)
      channelProtocol.requestEvents.set(`${seqId}`, body[0]);
      data[1] = [];
    } else {
      // Regular method: Create deferred for response handling
      const returnValue = createDeferred();
      channelProtocol.ongoingRequests.set(`${seqId}`, returnValue);
      value.returnValue = returnValue;
    }
    return value;
  };

  fn.lifecycle = SendMiddlewareLifecycle.Transform;
  return fn;
};
