import BindingTo from '../binding/BindingTo';
import Container from '../Container';
import { Ctor } from './binding';

export type ServiceIdentifier<T = unknown> = string | Ctor<T> | symbol;
export type ModuleIdentifier = ServiceIdentifier;
export type ContainerBind = (id: ModuleIdentifier) => BindingTo;

export interface Context {
  container: Container;
}
