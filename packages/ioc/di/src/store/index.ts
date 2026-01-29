import Module from './Module';
import { DecoratorTarget, ModuleIdentifier, RegistryType } from '../types';
import { createHiddenProperty, IS_INJECTABLE } from '../common';

export namespace store {
  export const moduleMap = new Map<any, Module>();

  // export const getModule = (id: ModuleIdentifier) => moduleMap.get(id)
  export const setModule = (id: any, module: Module) =>
    moduleMap.set(id, module);

  export const hasTargetModule = (decoratorTarget: DecoratorTarget) => {
    return moduleMap.has(decoratorTarget);
    // const id = moduleIdentifierExtractor(decoratorTarget)
    // return moduleMap.has(id)
  };
  export const getTargetModule = (target: DecoratorTarget) => {
    return moduleMap.get(target);
    // const id = moduleIdentifierExtractor(target)
    // return getModule(id)
  };
}

export function registerModule(
  target: DecoratorTarget,
  registryType: RegistryType
) {
  if (!target) return null;
  // const id = moduleIdentifierExtractor(target)
  const _module = new Module({ target, registryType });
  // store.setModule(id, _module)
  store.setModule(target, _module);
  return _module;
}

export function ensureModule(target: DecoratorTarget) {
  if (!target) return null;
  const targetModule = store.getTargetModule(target);
  if (targetModule) return targetModule;
  const _module = registerModule(target, RegistryType.Init);
  createHiddenProperty(target, IS_INJECTABLE, true);
  return _module;
}

export function addDependencies(
  target: DecoratorTarget,
  dependencyModuleIdentifier: ModuleIdentifier,
  propertyName: string,
  index?: number
) {
  if (typeof index !== 'number') {
    // if it's a property binding, then use target.constructor
    const targetModule = ensureModule(target.constructor as DecoratorTarget);
    targetModule.addPropertyDependency(
      dependencyModuleIdentifier,
      propertyName
    );
  } else {
    const targetModule = ensureModule(target);
    targetModule.addConstructorDependency(dependencyModuleIdentifier, index);
  }
}
