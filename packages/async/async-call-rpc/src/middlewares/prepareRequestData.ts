import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';
import {
  SendingProps,
  RequestEntryHeader,
  HostRequestEntryHeader,
  RequestType,
  SendMiddlewareLifecycle,
} from '../types';

/**
 * Parse the overloaded arguments of a middleware function into a
 * normalised structure.
 *
 * Supports two calling conventions:
 *   1. `(requestPath, methodName, ...params)`
 *   2. `(SendingProps, transfer?)`
 */
function parseRequestArgs(
  props: string | SendingProps,
  args: any[]
): {
  requestPath: string;
  methodName: string;
  params: any[];
  transfer: any[];
  isOptionsRequest: boolean;
  requestType: RequestType;
} {
  if (typeof props === 'string') {
    return {
      requestPath: props,
      methodName: args[0],
      params: args.slice(1),
      transfer: [],
      isOptionsRequest: false,
      requestType: RequestType.PromiseRequest,
    };
  }

  return {
    requestPath: props.requestPath,
    methodName: props.methodName,
    params: [].concat(props.args),
    transfer: props.transfer || args[0] || [],
    isOptionsRequest: !!props.isOptionsRequest,
    requestType:
      (props.requestType as RequestType) || RequestType.PromiseRequest,
  };
}

export const preparePortData = (channel: AbstractChannelProtocol) => {
  const fn = (props: string | SendingProps, ...args: any[]) => {
    const seqId = channel.seqId;
    const { requestPath, methodName, params, transfer, isOptionsRequest } =
      parseRequestArgs(props, args);

    const header: RequestEntryHeader = [
      RequestType.PromiseRequest,
      seqId,
      requestPath,
      methodName,
    ];

    return {
      seqId,
      transfer,
      isOptionsRequest,
      data: [header, params],
    };
  };

  fn.lifecycle = SendMiddlewareLifecycle.Prepare;
  return fn;
};

export const prepareHostPortData = (
  channel: AbstractChannelProtocol & { channelName?: string }
) => {
  const fn = (props: string | SendingProps, ...args: any[]) => {
    const seqId = channel.seqId;
    const { requestPath, methodName, params, transfer, isOptionsRequest } =
      parseRequestArgs(props, args);

    const header: HostRequestEntryHeader = [
      RequestType.PromiseRequest,
      seqId,
      requestPath,
      methodName,
      channel.channelName ?? '',
    ];

    return {
      seqId,
      transfer,
      isOptionsRequest,
      data: [header, params],
    };
  };

  fn.lifecycle = SendMiddlewareLifecycle.Prepare;
  return fn;
};

export const prepareNormalData = (channel: AbstractChannelProtocol) => {
  const fn = (props: string | SendingProps, ...args: any[]) => {
    const seqId = channel.seqId;
    const { requestPath, methodName, params, isOptionsRequest, requestType } =
      parseRequestArgs(props, args);

    const header: RequestEntryHeader = [
      requestType,
      seqId,
      requestPath,
      methodName,
    ];

    return {
      seqId,
      isOptionsRequest,
      data: [header, params],
    };
  };

  fn.lifecycle = SendMiddlewareLifecycle.Prepare;

  return fn;
};
