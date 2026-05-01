import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';
import {
  SendingProps,
  RequestEntryHeader,
  HostRequestEntryHeader,
  RequestType,
  SendMiddlewareLifecycle,
} from '../types';

export const preparePortData = (channel: AbstractChannelProtocol) => {
  const fn = (props: string | SendingProps, ...args: any[]) => {
    let requestPath = '';
    let methodName = '';
    let params = [] as any[];
    let transfer = [];
    let isOptionsRequest = false;

    const seqId = channel.seqId;

    if (typeof props === 'string') {
      requestPath = props;
      methodName = args[0];
      params = args.slice(1);
    } else {
      requestPath = props.requestPath;
      methodName = props.methodName;
      isOptionsRequest = props.isOptionsRequest;
      params = [].concat(props.args);
      transfer = args[0] ? args[0] : [];
    }

    const header: RequestEntryHeader = [
      RequestType.PromiseRequest,
      seqId,
      requestPath,
      methodName,
    ];

    const body = params;
    return {
      seqId,
      transfer,
      isOptionsRequest,
      data: [header, body],
    };
  };

  fn.lifecycle = SendMiddlewareLifecycle.Prepare;
  return fn;
};

export const prepareHostPortData = (channel: AbstractChannelProtocol) => {
  const fn = (props: string | SendingProps, ...args: any[]) => {
    let requestPath = '';
    let methodName = '';
    let params = [] as any[];
    let transfer = [];
    const seqId = channel.seqId;
    let isOptionsRequest = false;

    if (typeof props === 'string') {
      requestPath = props;
      methodName = args[0];
      params = args.slice(1);
    } else {
      requestPath = props.requestPath;
      methodName = props.methodName;
      isOptionsRequest = props.isOptionsRequest;
      params = [].concat(props.args);
      transfer = args[0] ? args[0] : [];
    }

    const header: HostRequestEntryHeader = [
      RequestType.PromiseRequest,
      seqId,
      requestPath,
      methodName,
      // @ts-ignore
      channel.channelName,
    ];

    const body = params;

    return {
      seqId,
      transfer,
      isOptionsRequest,
      data: [header, body],
    };
  };

  fn.lifecycle = SendMiddlewareLifecycle.Prepare;
  return fn;
};

export const prepareNormalData = (channel: AbstractChannelProtocol) => {
  const fn = (props: string | SendingProps, ...args: any[]) => {
    let requestPath = '';
    let methodName = '';
    let params = [] as any[];
    const seqId = channel.seqId;
    let isOptionsRequest = false;
    let requestType = RequestType.PromiseRequest;

    if (typeof props === 'string') {
      requestPath = props;
      methodName = args[0];
      params = args.slice(1);
    } else {
      requestPath = props.requestPath;
      methodName = props.methodName;
      isOptionsRequest = props.isOptionsRequest;
      // args will convert to array on default
      params = [].concat(props.args);

      // Support subscription request types
      if ((props as any).requestType) {
        requestType = (props as any).requestType;
      }
    }

    const header: RequestEntryHeader = [
      requestType,
      seqId,
      requestPath,
      methodName,
    ];

    const body = params;

    return {
      seqId,
      isOptionsRequest,
      data: [header, body],
    };
  };

  fn.lifecycle = SendMiddlewareLifecycle.Prepare;

  return fn;
};
