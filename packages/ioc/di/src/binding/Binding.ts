import Container from '../Container';
import Scope from '../scope/Scope';
import {
  BindingProps,
  BindingType,
  BindingValue,
  ModuleIdentifier,
  ToValue,
} from '../types';

class Binding {
  private _identifier: ModuleIdentifier;

  private _type: BindingType;

  private _to: ToValue;

  private _value: BindingValue;

  private _container: Container;

  private _scope: Scope;

  constructor(props: BindingProps) {
    const { identifier, container } = props;
    this._identifier = identifier;
    this._container = container;
    this._scope = new Scope();
  }

  get container() {
    return this._container;
  }

  get to() {
    return this._to;
  }

  set to(v: any) {
    this._to = v;
  }

  get type() {
    return this._type;
  }

  set type(type: BindingType) {
    this._type = type;
  }

  get value() {
    return this._value;
  }

  set value(value: BindingValue) {
    this._value = value;
  }

  get identifier() {
    return this._identifier;
  }

  get scope() {
    return this._scope;
  }
}

export default Binding;
