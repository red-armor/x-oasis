import Binding from './Binding';
import {
  BindingToProps,
  ToValueCtor,
  ToValueDynamicValue,
  BindingType,
} from '../types';

class BindingTo {
  private binding: Binding;

  constructor(props: BindingToProps) {
    this.binding = props.binding;
  }

  toSelf() {
    this.binding.type = BindingType.Constructor;
    this.binding.to = this.binding.identifier;
    return this.binding.scope;
  }

  toConstantValue(value: any) {
    this.binding.type = BindingType.ConstantValue;
    this.binding.value = value;
    return this.binding.scope;
  }

  to(value: ToValueCtor) {
    this.binding.type = BindingType.Constructor;
    this.binding.to = value;
    return this.binding.scope;
  }

  toDynamicValue(value: ToValueDynamicValue) {
    this.binding.type = BindingType.DynamicValue;
    this.binding.to = value;
    return this.binding.scope;
  }

  toParamsFactory(value: ToValueCtor) {
    this.binding.type = BindingType.ParamsFactory;
    this.binding.to = value;
    this.binding.value = (...args: any[]) => {
      return this.binding.container.resolve(value, ...args);
    };
    return this.binding.scope;
  }
}

export default BindingTo;
