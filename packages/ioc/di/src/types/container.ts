import BindingTo from '../binding/BindingTo';
import { Ctor } from './binding';
import Container from '../Container';

export type ServiceIdentifier<T = unknown> = string | Ctor<T> | symbol;
export type ModuleIdentifier = ServiceIdentifier;
export type ContainerBind = (id: ModuleIdentifier) => BindingTo;

export interface Context {
  container: Container;
}
