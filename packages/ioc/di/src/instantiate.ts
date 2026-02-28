import Binding from './binding/Binding';
import { isInjectable } from './common';
import { BINDING_NOT_FOUND } from './constants/error';
import Container from './Container';
import { store } from './store';
import { Ctor, BindingType } from './types';

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
      const current = constructorDeps[idx];
      const { id, index } = current;

      const moduleBinding = container.getBinding(id);

      if (!moduleBinding) {
        throw new Error(BINDING_NOT_FOUND(id, index));
      }

      if (moduleBinding.value != null) args[index] = moduleBinding.value;
      else {
        args[index] = instantiate(moduleBinding, container);
        if (moduleBinding.type !== BindingType.ParamsFactory)
          moduleBinding.value = args[index];
      }
    }

    // passing params should be insert on before
    passingArgs.forEach(
      (constructorParam, index) => (args[index] = constructorParam)
    );

    const instance = new ctor(...args) as any;

    const propertyDeps = module.propertyDeps;

    for (let idx = 0; idx < propertyDeps.length; idx++) {
      const current = propertyDeps[idx];
      const { id, propertyName } = current;

      const moduleBinding = container.getBinding(id);

      if (!moduleBinding) {
        throw new Error(BINDING_NOT_FOUND(id, idx));
      }

      if (moduleBinding.value != null) {
        instance[propertyName] = moduleBinding.value;
      } else {
        instance[propertyName] = instantiate(moduleBinding, container);
        if (moduleBinding.type !== BindingType.ParamsFactory)
          moduleBinding.value = instance[propertyName];
      }
    }

    if (binding instanceof Binding) binding.value = instance;

    return instance;
  } catch (err) {
    console.error(
      '[instantiate error ] ',
      binding,
      binding?.identifier,
      binding?.to,
      err
    );
    return null;
  }
}
