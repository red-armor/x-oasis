import { SenderMiddlewareOutput, SendMiddlewareLifecycle } from '../types';
import AbstractChannelProtocol from '../AbstractChannelProtocol';

export const sendRequest = (channelProtocol: AbstractChannelProtocol) => {
  const fn = (value: SenderMiddlewareOutput) => {
    const { data, transfer } = value;
    if (transfer) channelProtocol.channel.send(data, transfer);
    else channelProtocol.channel.send(data);

    return value;
  };

  fn.lifecycle = SendMiddlewareLifecycle.Send;
  return fn;
};
