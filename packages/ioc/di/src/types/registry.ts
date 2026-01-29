import { ContainerBind } from './container';

export type RegistryFactory = (bind: ContainerBind) => void;

export type RegistryOptions = {
  eager?: boolean;
};
