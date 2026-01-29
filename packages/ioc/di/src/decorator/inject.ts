import { ModuleIdentifier, DecoratorTarget } from '../types';
import { addDependencies } from '../store';

export function inject<T>(moduleIdentifier: ModuleIdentifier) {
  return (target: DecoratorTarget<T>, propertyName: string, index?: number) => {
    addDependencies(target, moduleIdentifier, propertyName, index);
  };
}
