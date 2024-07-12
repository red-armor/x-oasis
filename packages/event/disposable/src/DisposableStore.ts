import { isArray } from '@redcity/core/common/assertion/types';
import { Iterable } from '@redcity/core/common/assertion/iterable';
import { IDisposable } from './types/disposable';
import { isDisposable } from './Disposable';

export function dispose<T extends IDisposable>(disposable: T): T;
export function dispose<T extends IDisposable>(
  disposable: T | undefined
): T | undefined;
export function dispose<T extends IDisposable>(
  arg: T | Iterable<T> | undefined
): any;
export function dispose<T extends IDisposable>(
  disposables: T[]
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
  if (isDisposable<IDisposable>(disposables)) {
    try {
      disposables.dispose();
    } catch (err) {
      errors.push(err);
    }
    return disposables;
  }
  if (Iterable.is<IDisposable>(disposables)) {
    for (const disposable of disposables) {
      try {
        disposable?.dispose();
      } catch (err) {
        errors.push(err);
      }
    }
  }
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
