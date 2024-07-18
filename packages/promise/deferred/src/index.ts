export type Deferred<T = any> = {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (err?: unknown) => void;
  promise: PromiseLike<T>;
};

export function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T | PromiseLike<T>) => void = null;
  let reject: (err?: unknown) => void = null;

  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });

  return {
    promise,
    resolve,
    reject,
  };
}
