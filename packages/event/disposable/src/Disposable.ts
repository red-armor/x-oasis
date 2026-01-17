import DisposableStore from './DisposableStore';
import { IDisposable } from './types/disposable';
import { isFunction, isObject } from './utils';

export function isDisposable<T extends object>(
  thing: T
): thing is T & IDisposable {
  return isObject(thing) && isFunction((thing as IDisposable).dispose);
}

export function toDisposable(fn: Function): IDisposable {
  return {
    dispose: () => fn(),
  };
}

export class Disposable implements IDisposable {
  static readonly None = Object.freeze<IDisposable>({ dispose() {} });

  private readonly _store = new DisposableStore();

  public dispose(): void {
    this._store.dispose();
  }

  registerDisposable<T extends IDisposable>(disposable: T) {
    if ((disposable as any) === this) {
      throw new Error('Can not register itself');
    }
    this._store.add(disposable);
  }
}
