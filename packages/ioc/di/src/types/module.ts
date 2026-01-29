import { ModuleIdentifier } from './container';
import { DecoratorTarget } from './decorator';

export type ModuleProps = {
  // id: string
  registryType?: RegistryType;
  target: DecoratorTarget;
};

export type ModulePropertyDepToken = {
  // module: Module
  id: ModuleIdentifier;
  propertyName: string;
};

export type ModuleConstructorDepToken = {
  // module: Module
  id: ModuleIdentifier;
  index: number;
};

export enum RegistryType {
  Injected = 'injected',
  Init = 'init',
}
