import {
  NormalizedRawMessageOutput,
  SenderMiddlewareOutput,
  SendMiddlewareLifecycle,
} from '../types';
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';

export const serialize = (channel: AbstractChannelProtocol) => {
  const fn = (value: SenderMiddlewareOutput) => ({
    ...value,
    data: channel.writeBuffer.encode(value.data),
  });

  fn.lifecycle = SendMiddlewareLifecycle.DataOperation;
  return fn;
};

export const deserialize =
  (channel: AbstractChannelProtocol) => (value: NormalizedRawMessageOutput) => {
    const { data } = value;
    let decoded = data;

    try {
      decoded = channel.readBuffer.decode(data);
    } catch (err) {
      console.error('[decode error]', data, err);
    }

    return {
      ...value,
      data: decoded,
    };
  };
