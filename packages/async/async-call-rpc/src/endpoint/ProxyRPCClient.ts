import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';

class ProxyRPCClient {
  readonly requestPath: string;

  private channel: AbstractChannelProtocol;

  constructor(
    requestPath: string,
    options?: {
      channel?: AbstractChannelProtocol;
    }
  ) {
    const { channel } = options || {};
    this.requestPath = requestPath;
    this.setChannel(channel);
  }

  setChannel(channel: AbstractChannelProtocol) {
    this.channel = channel;
  }

  createProxy<T = object>(): T {
    const getTrap =
      (_: any, methodName: string) =>
      (...args: any[]) => {
        if (!this.channel) {
          throw new Error(
            `[ProxyRPCClient error] \`this.channel\` is null, when invoke function ${methodName}`
          );
        }
        this.channel.makeRequest({
          requestPath: this.requestPath,
          methodName,
          args,
        });
      };

    return new Proxy(
      {},
      {
        get: getTrap,
      }
    ) as any as T;
  }
}

export default ProxyRPCClient;
