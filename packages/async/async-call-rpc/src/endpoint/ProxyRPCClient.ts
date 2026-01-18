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
    if (channel) {
      this.setChannel(channel);
    }
  }

  setChannel(channel: AbstractChannelProtocol) {
    this.channel = channel;
    // this.channel.on(this.handleMessage.bind(this));
  }

  handleMessage(...args: any[]) {
    this.channel.onMessage(...args);
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
        return this.channel.makeRequest({
          requestPath: this.requestPath,
          methodName,
          args,
          // @ts-ignore, 这个地方其实是跟 `updateSeqInfo` 中间件配合的
          // 因为`updateSeqInfo` 中间件会在`makeRequest`之后，将返回值设置到`returnValue`中
          // 所以这里需要返回`promise`，以便于在`createProxy`中能够正确地返回`promise`
          // 否则的话，会出现`promise`不正确的问题
          // 因为`makeRequest`会返回`promise`，但是`createProxy`会返回`proxy`
          // 所以这里需要返回`promise`，以便于在`createProxy`中能够正确地返回`promise`
          // 否则的话，会出现`promise`不正确的问题
          // 因为`makeRequest`会返回`promise`，但是`createProxy`会返回`proxy`
          // 所以这里需要返回`promise`，以便于在`createProxy`中能够正确地返回`promise`
        }).promise;
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
