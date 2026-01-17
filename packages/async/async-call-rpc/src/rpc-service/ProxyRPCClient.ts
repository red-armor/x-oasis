import {
  isEventMethod,
  isAssignPassingPortMethod,
  isOptionsMethod,
} from '../common';
import { ProxyRPCClientProps, ProxyRPCClientChannel } from '../types';

class ProxyRPCClient {
  private requestPath: string;

  private _channelProtocol: ProxyRPCClientChannel;

  constructor(props: ProxyRPCClientProps) {
    this._channelProtocol = props.channel;
    this.requestPath = props.requestPath;
  }

  get channelProtocol() {
    if (typeof this._channelProtocol === 'function')
      return this._channelProtocol();
    return this._channelProtocol;
  }

  createProxy<T = object>(): T {
    return new Proxy(
      {},
      {
        get: (target, key) => {
          return (...args: any[]): T => {
            const fnName = key.toString();
            if (!this.channelProtocol) {
              throw new Error(
                `[ProxyRPCClient error] \`this.channelProtocol\` is null, when invoke function ${fnName}`
              );
            }

            if (isAssignPassingPortMethod(fnName)) {
              const ports = args.pop();
              this.channelProtocol.send(
                {
                  requestPath: this.requestPath,
                  fnName,
                  args,
                },
                [].concat(ports)
              );
            } else if (isEventMethod(fnName)) {
              this.channelProtocol.send({
                requestPath: this.requestPath,
                fnName,
                args,
              });
            } else if (
              /**
               * 主要是为了解决刚开始channel connected状态是待确定，而所有的rpc 原则上都是先
               * 过isConnected的判断；但是想要确保是否通的，这个时候其实还是要发rpc确认的，
               * 那么这个时候这个就不能够受 isConnected约束；否则你就一直没有请求能够发出去了。
               */
              isOptionsMethod(fnName)
            ) {
              this.channelProtocol.send({
                isOptionsRequest: true,
                requestPath: this.requestPath,
                fnName,
                args,
              });
            } else {
              this.channelProtocol.send({
                requestPath: this.requestPath,
                fnName,
                args,
              }).promise as T;
            }
          };
        },
      }
    ) as any as T;
  }
}

export default ProxyRPCClient;
