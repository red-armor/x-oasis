import { Deferred } from '@x-oasis/deferred';
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
  }

  handleMessage(...args: any[]) {
    this.channel.onMessage(...args);
  }

  /**
   * Create a type-safe proxy object that forwards method calls as RPC requests.
   *
   * The proxy intercepts property access and returns a function that:
   * 1. Calls `channel.makeRequest()` to send the RPC request
   * 2. Returns the promise from the `updateSeqInfo` middleware
   *    (which sets `returnValue` as a Deferred on the request)
   */
  createProxy<
    T extends Record<string, (...args: any[]) => any> = Record<
      string,
      (...args: any[]) => Promise<any>
    >
  >(): T {
    const getTrap =
      (_: any, methodName: string) =>
      (...args: any[]) => {
        if (!this.channel) {
          throw new Error(
            `[ProxyRPCClient] Channel is not set when invoking "${methodName}". ` +
              `Call setChannel() before making RPC calls.`
          );
        }
        const result = this.channel.makeRequest({
          requestPath: this.requestPath,
          methodName,
          args,
        });
        return (result as Deferred).promise;
      };

    return new Proxy({} as T, { get: getTrap });
  }
}

export default ProxyRPCClient;
