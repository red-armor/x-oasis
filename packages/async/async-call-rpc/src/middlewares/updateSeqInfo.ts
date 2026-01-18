import { createDeferred } from '@x-oasis/deferred';
import { isEventMethod } from '../common';
import { SenderMiddlewareOutput, SendMiddlewareLifecycle } from '../types';
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';

export const updateSeqInfo = (channelProtocol: AbstractChannelProtocol) => {
  const fn = (value: SenderMiddlewareOutput) => {
    const { data, seqId } = value;
    const header = data[0];
    const body = data[1];
    const methodName = header[3];

    // 如果说是event method的话，需要将body重制一下
    if (methodName && isEventMethod(methodName)) {
      channelProtocol.requestEvents.set(`${seqId}`, body[0]);
      data[1] = [];
    } else {
      const returnValue = createDeferred();
      channelProtocol.ongoingRequests.set(`${seqId}`, returnValue);
      value.returnValue = returnValue;
    }
    return value;
  };

  fn.lifecycle = SendMiddlewareLifecycle.Transform;
  return fn;
};
