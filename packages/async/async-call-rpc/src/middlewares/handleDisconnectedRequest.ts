import { SenderMiddlewareOutput, SendMiddlewareLifecycle } from '../types';
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';

export const handleDisconnectedRequest = (
  protocol: AbstractChannelProtocol
) => {
  const fn = (value: SenderMiddlewareOutput) => {
    const isConnected = protocol.isConnected();

    if (!isConnected && !value.isOptionsRequest) {
      protocol.addPendingSendEntry({
        fnName: fn.displayName,
        lifecycle: SendMiddlewareLifecycle.Prepare,
        ...value,
        middlewareContext: {
          ...value.middlewareContext,
        },
      });

      value.middlewareContext.minLifecycle = SendMiddlewareLifecycle.Aborted;
    }

    return value;
  };

  fn.displayName = 'handleDisconnectedRequest';
  fn.lifecycle = SendMiddlewareLifecycle.Prepare;

  return fn;
};
