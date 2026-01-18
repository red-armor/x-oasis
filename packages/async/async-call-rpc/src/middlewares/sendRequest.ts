import { SenderMiddlewareOutput, SendMiddlewareLifecycle } from '../types';
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';

export const sendRequest = (channelProtocol: AbstractChannelProtocol) => {
  const fn = (value: SenderMiddlewareOutput) => {
    const { data, transfer } = value;
    if (transfer) channelProtocol.send(data, transfer);
    else channelProtocol.send(data);

    return value;
  };

  fn.lifecycle = SendMiddlewareLifecycle.Send;
  return fn;
};
