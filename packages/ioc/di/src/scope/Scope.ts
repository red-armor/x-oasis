import { IScope } from '../types';

export default class Scope {
  private _value: IScope;

  get value() {
    return this._value;
  }

  set value(value: IScope) {
    this._value = value;
  }

  toSingletonScope() {
    this._value = IScope.Singleton;
  }

  inSingletonScope() {
    return this._value === IScope.Singleton;
  }
}
