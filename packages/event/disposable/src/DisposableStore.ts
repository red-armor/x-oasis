import { isDisposable } from './Disposable';
import { IDisposable } from './types/disposable';
import { isArray, isIterable } from './utils';

export function dispose<T extends IDisposable>(disposable: T): T;
export function dispose<T extends IDisposable>(
  disposable: T | undefined
): T | undefined;
export function dispose<T extends IDisposable>(
  arg: T | Iterable<T> | undefined
): any;
export function dispose<T extends IDisposable>(
  disposables: T | T[] | Iterable<T> | undefined
): T | T[] | undefined {
  const errors = [];
  if (isArray(disposables)) {
    disposables.forEach((disposable) => {
      try {
        disposable?.dispose();
      } catch (err) {
        errors.push(err);
      }
    });
    return [];
  }
  if (isIterable<IDisposable>(disposables) && !isArray(disposables)) {
    for (const disposable of disposables as Iterable<IDisposable>) {
      try {
        disposable?.dispose();
      } catch (err) {
        errors.push(err);
      }
    }
    return undefined;
  }
  if (
    disposables &&
    !isArray(disposables) &&
    !isIterable(disposables) &&
    isDisposable<IDisposable>(disposables)
  ) {
    try {
      (disposables as IDisposable).dispose();
    } catch (err) {
      errors.push(err);
    }
    return disposables as T;
  }
  return undefined;
}

export default class DisposableStore implements IDisposable {
  private readonly _toDispose = new Set<IDisposable>();

  private _isDisposed = false;

  public dispose(): void {
    if (this._isDisposed) {
      return;
    }

    this._isDisposed = true;
    this.clear();
  }

  public get isDisposed(): boolean {
    return this._isDisposed;
  }

  public clear(): void {
    if (this._toDispose.size === 0) {
      return;
    }

    dispose(this._toDispose);

    this._toDispose.clear();
  }

  public add<T extends IDisposable>(thing: T): T {
    if (!thing) return thing;
    if ((thing as unknown as DisposableStore) === this) {
      throw new Error('Cannot register a disposable on itself!');
    }

    if (this._isDisposed) {
      // ...
    } else {
      this._toDispose.add(thing);
    }

    return thing;
  }

  public delete<T extends IDisposable>(thing: T): void {
    if (!thing) {
      return;
    }
    if ((thing as unknown as DisposableStore) === this) {
      throw new Error('Cannot dispose a disposable on itself!');
    }
    this._toDispose.delete(thing);
    thing.dispose();
  }
}
