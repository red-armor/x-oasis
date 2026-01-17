import { toDisposable } from '@x-oasis/disposable';
import { EventListener, EventProps } from './types';

export default class Event {
  readonly name: string;

  private _listeners: EventListener[] = [];

  private _onWillAddFirstListener?: Function;

  private _onDidAddFirstListener?: Function;

  private _onDidAddListener?: Function;

  private _onWillRemoveListener?: Function;

  private _onDidRemoveLastListener?: Function;

  private _coldTrigger?: boolean;

  private _cacheCurrentValue?: any[] | undefined;

  constructor(props: EventProps & { name: string }) {
    const {
      name,
      onWillAddFirstListener,
      onDidAddFirstListener,
      onDidAddListener,
      onWillRemoveListener,
      onDidRemoveLastListener,
      coldTrigger,
    } = props;

    this.name = name;

    this._coldTrigger = coldTrigger;
    this._onWillAddFirstListener = onWillAddFirstListener;
    this._onDidAddFirstListener = onDidAddFirstListener;
    this._onDidAddListener = onDidAddListener;
    this._onWillRemoveListener = onWillRemoveListener;
    this._onDidRemoveLastListener = onDidRemoveLastListener;
    this.subscribe = this.subscribe.bind(this);
  }

  subscribe(listener: EventListener) {
    if (!this._listeners.length) {
      this._onWillAddFirstListener?.();
    }

    const index = this._listeners.indexOf(listener);
    if (index !== -1) {
      console.error('add a duplicate listener');
    } else {
      this._listeners.push(listener);
      if (this._listeners.length === 1) this._onDidAddFirstListener?.();
      this._onDidAddListener?.();
      if (this._coldTrigger && this._cacheCurrentValue)
        listener(...this._cacheCurrentValue);
    }

    return toDisposable(() => {
      this.removeListener(listener);
    });
  }

  removeListener(listener: EventListener) {
    const index = this._listeners.indexOf(listener);
    if (index === -1) return;
    this._onWillRemoveListener?.();

    this._listeners.splice(index, 1);
    if (!this._listeners.length) {
      this._onDidRemoveLastListener?.();
    }
  }

  dispose() {
    this._listeners = [];
    this._onDidRemoveLastListener?.();
  }

  fire(...args: any[]) {
    if (this._coldTrigger) {
      this._cacheCurrentValue = args;
    }
    for (const listener of this._listeners) {
      listener(...args);
    }
  }
}
