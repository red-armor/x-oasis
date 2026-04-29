import Binding from './binding/Binding';
import { isInjectable } from './common';
import { BINDING_NOT_FOUND } from './constants/error';
import Container from './Container';
import { store } from './store';
import { Ctor, BindingType } from './types';

function _resolveDependency(
  id: any,
  index: number | string,
  container: Container,
  isProperty: boolean
): any {
  const moduleBinding = container.getBinding(id);

  if (!moduleBinding) {
    throw new Error(BINDING_NOT_FOUND(id, index as number));
  }

  if (moduleBinding.value != null) {
    return moduleBinding.value;
  }

  const resolved = instantiate(moduleBinding, container);
  if (moduleBinding.type !== BindingType.ParamsFactory) {
    moduleBinding.value = resolved;
  }

  return resolved;
}

export function instantiate(
  binding: Binding | Ctor,
  container: Container,
  ...passingArgs: any[]
): any {
  try {
    let ctor: Ctor = binding as Ctor;

    if (binding instanceof Binding) {
      if (binding.type === BindingType.DynamicValue) {
        binding.value = binding.to({ container });
        return binding.value;
      }

      ctor = binding.to;
    }

    if (!isInjectable(ctor)) return new ctor();

    const module = store.getTargetModule(ctor);

    const constructorDeps = module.constructorDeps || [];

    const args = [];

    for (let idx = 0; idx < constructorDeps.length; idx++) {
      const { id, index } = constructorDeps[idx];
      args[index] = _resolveDependency(id, index, container, false);
    }

    passingArgs.forEach(
      (constructorParam, index) => (args[index] = constructorParam)
    );

    const instance = new ctor(...args) as any;

    const propertyDeps = module.propertyDeps;

    for (let idx = 0; idx < propertyDeps.length; idx++) {
      const { id, propertyName } = propertyDeps[idx];
      instance[propertyName] = _resolveDependency(
        id,
        propertyName,
        container,
        true
      );
    }

    if (binding instanceof Binding) binding.value = instance;

    return instance;
  } catch (err) {
    console.error(
      '[instantiate error] Constructor:',
      binding instanceof Binding ? (binding as Binding).identifier : binding,
      'Details:',
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}
