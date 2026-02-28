import Container from '../Container';
import { Context, ModuleIdentifier } from './container';

export type Ctor<T = object> = new (...args: any[]) => T;

export enum BindingType {
  Constructor = 'constructor',
  ConstantValue = 'constantValue',
  Factory = 'factory',
  ParamsFactory = 'paramsFactory',
  DynamicValue = 'dynamicValue',
}

export enum BindingTo {
  Constructor = 'constructor',
}

export type BindingFactory = (ctx: Context) => Function;

export type ToValueCtor = Ctor;
export type ToValueBindingFactory = BindingFactory;
export type ToValueBindingParamsFactory = Ctor;
export type ToValueDynamicValue = (ctx: Context) => any;

export type ToValue =
  | ToValueCtor
  | ToValueBindingFactory
  | ToValueBindingParamsFactory;

export type BindingValue = any;

export type BindingProps = {
  container: Container;
  to?: ToValue;
  value?: BindingValue;
  type?: BindingType;
  identifier: ModuleIdentifier;
};
