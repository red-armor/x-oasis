import { Deferred } from '@x-oasis/deferred';
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';
import { RequestType, Unsubscribable } from '../types';
import { isEventMethod } from '../common';

/**
 * Subscription callbacks.
 */
export interface SubscriptionObserver<T = any> {
  onData: (value: T) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

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
    this.channel.on(this.handleMessage.bind(this));
  }

  handleMessage(...args: any[]) {
    this.channel.onMessage(...args);
  }

  /**
   * Create a type-safe proxy object that forwards method calls as RPC requests.
   *
   * The proxy intercepts property access and returns a function that:
   * 1. For regular methods: calls `channel.makeRequest()` and returns a promise
   * 2. For event methods (on*): stores the callback client-side and returns an unsubscriber function
   *
   * Event methods (ping-pong pattern):
   *   const unsub = client.onPing((data) => console.log(data));
   *   unsub();  // Stop listening
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

        // Handle ping-pong event methods (on*).
        // These methods take a callback and return an unsubscriber function.
        if (isEventMethod(methodName)) {
          const callback = args[0];

          // Send request without args (callback cannot be serialized)
          const result = this.channel.makeRequest({
            requestPath: this.requestPath,
            methodName,
            args: [], // Event method args are not serialized
          });

          const deferred = result as Deferred;
          const seqId = (deferred as any).seqId;

          // Store the callback on the client side so handleResponse can invoke it
          if (seqId && typeof callback === 'function') {
            this.channel.requestEvents.set(seqId, callback);
          }

          // Return unsubscriber function
          const channel = this.channel;
          return {
            unsubscribe: () => {
              // Clean up client-side callback
              if (seqId) {
                channel.requestEvents.delete(seqId);
              }

              // Send EventMethodStop to server
              channel.makeRequest({
                requestPath: this.requestPath,
                methodName,
                args: [],
                requestType: RequestType.EventMethodStop,
              } as any);
            },
          };
        }

        // Regular method: return promise
        const result = this.channel.makeRequest({
          requestPath: this.requestPath,
          methodName,
          args,
        });
        return (result as Deferred).promise;
      };

    return new Proxy({} as T, { get: getTrap });
  }

  /**
   * Subscribe to a streaming RPC method.
   *
   * Sends a `SubscriptionRequest` to the server and routes incoming
   * `ReturnSuccess` values to the `onData` callback. Returns an
   * `Unsubscribable` that sends a `SubscriptionStop` on unsubscribe.
   *
   * @param methodName  - The remote method that returns an observable.
   * @param args        - Arguments forwarded to the remote method.
   * @param observer    - Callbacks for data, error, and completion.
   * @returns An Unsubscribable to cancel the subscription.
   *
   * @example
   * ```ts
   * const unsub = client.subscribe('watchFiles', ['/src'], {
   *   onData: (event) => console.log('File changed:', event),
   *   onError: (err) => console.error(err),
   *   onComplete: () => console.log('Stream ended'),
   * });
   *
   * // Later: cancel the subscription
   * unsub.unsubscribe();
   * ```
   */
  subscribe<T = any>(
    methodName: string,
    args: any[],
    observer: SubscriptionObserver<T>
  ): Unsubscribable {
    if (!this.channel) {
      throw new Error(
        `[ProxyRPCClient] Channel is not set when subscribing to "${methodName}". ` +
          `Call setChannel() before making RPC calls.`
      );
    }

    const result = this.channel.makeRequest({
      requestPath: this.requestPath,
      methodName,
      args,
      requestType: RequestType.SubscriptionRequest,
    } as any);

    const deferred = result as Deferred;
    // Mark this deferred as a subscription so handleResponse knows
    // not to clean it up after the first response
    (deferred as any)._isSubscription = true;

    // Extract the seqId from the deferred to register event listeners
    const seqId = (deferred as any)._seqId || (deferred as any).seqId;

    // Register a structured subscription listener on the protocol
    // We need to find the seqId — look for the latest ongoing request
    // that has _isSubscription set
    let subscriptionSeqId: string | null = null;
    for (const [sid, d] of this.channel.ongoingRequests.entries()) {
      if ((d as any)._isSubscription) {
        subscriptionSeqId = sid;
      }
    }

    if (subscriptionSeqId) {
      // Register the data callback
      const listener = (value: T) => {
        observer.onData(value);
      };
      (listener as any)._onComplete = () => {
        observer.onComplete?.();
      };
      this.channel.requestEvents.set(subscriptionSeqId, listener);
    }

    // Handle subscription errors via the deferred's promise
    deferred.promise.then(undefined, (err: Error) => {
      observer.onError?.(err);
    });

    const channel = this.channel;
    const capturedSeqId = subscriptionSeqId;

    return {
      unsubscribe: () => {
        if (capturedSeqId) {
          // Send SubscriptionStop to the server
          channel.makeRequest({
            requestPath: this.requestPath,
            methodName: `__unsub_${capturedSeqId}`,
            args: [],
            requestType: RequestType.SubscriptionStop,
          } as any);

          // Clean up local state
          channel.ongoingRequests.delete(capturedSeqId);
          channel.requestEvents.delete(capturedSeqId);
          channel.subscriptions.delete(capturedSeqId);
        }
      },
    };
  }
}

export default ProxyRPCClient;
