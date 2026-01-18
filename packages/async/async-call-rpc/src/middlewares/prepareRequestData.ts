import AbstractChannelProtocol from '../AbstractChannelProtocol';
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
    let fnName = '';
    let params = [] as any[];
    let transfer = [];
    let isOptionsRequest = false;

    const seqId = channel.seqId;

    if (typeof props === 'string') {
      requestPath = props;
      fnName = args[0];
      params = args.slice(1);
    } else {
      requestPath = props.requestPath;
      fnName = props.fnName;
      isOptionsRequest = props.isOptionsRequest;
      // args will convert to array on default
      params = [].concat(props.args);
      transfer = args[0] ? args[0] : [];
    }

    const header: RequestEntryHeader = [
      RequestType.PromiseRequest,
      seqId,
      requestPath,
      fnName,
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
    let fnName = '';
    let params = [] as any[];
    let transfer = [];
    const seqId = channel.seqId;
    let isOptionsRequest = false;

    if (typeof props === 'string') {
      requestPath = props;
      fnName = args[0];
      params = args.slice(1);
    } else {
      requestPath = props.requestPath;
      fnName = props.fnName;
      isOptionsRequest = props.isOptionsRequest;
      // args will convert to array on default
      params = [].concat(props.args);
      transfer = args[0] ? args[0] : [];
    }

    const header: HostRequestEntryHeader = [
      RequestType.PromiseRequest,
      seqId,
      requestPath,
      fnName,
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
    let fnName = '';
    let params = [] as any[];
    const seqId = channel.seqId;
    let isOptionsRequest = false;

    if (typeof props === 'string') {
      requestPath = props;
      fnName = args[0];
      params = args.slice(1);
    } else {
      requestPath = props.requestPath;
      fnName = props.fnName;
      isOptionsRequest = props.isOptionsRequest;
      // args will convert to array on default
      params = [].concat(props.args);
    }

    const header: RequestEntryHeader = [
      RequestType.PromiseRequest,
      seqId,
      requestPath,
      fnName,
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
