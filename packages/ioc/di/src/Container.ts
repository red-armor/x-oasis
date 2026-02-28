import Binding from './binding/Binding';
import BindingTo from './binding/BindingTo';
import { isInjectable } from './common';
import { instantiate } from './instantiate';
import Registry from './Registry';
import { Ctor, ModuleIdentifier } from './types';

class Container {
  private _bindingStore = new Map<ModuleIdentifier, Binding>();

  private _belongs: Container = null;

  bind(identifier: ModuleIdentifier) {
    const binding = new Binding({
      identifier,
      container: this,
    });
    this._bindingStore.set(identifier, binding);
    return new BindingTo({ binding });
  }

  get bindingStore() {
    return this._bindingStore;
  }

  setBelongs(belongs: Container) {
    this._belongs = belongs;
  }

  getBinding(identifier: ModuleIdentifier | Ctor) {
    const bindingStack = [];

    let belongs: Container = this;

    while (belongs) {
      const binding = belongs.bindingStore.get(identifier);
      if (binding) bindingStack.push(binding);
      belongs = belongs._belongs;
    }

    // Aim to ensure singleton, get the top most instance.
    const lastIndex = bindingStack.length - 1;

    return bindingStack[lastIndex];
  }

  get(identifier: ModuleIdentifier | Ctor, ...args: any[]) {
    return this.resolve(identifier, ...args);
  }

  load(registry: Registry) {
    registry.load(this);
  }

  /**
   *
   * @param identifier
   * @returns
   *
   * container.resolve("LogService")
   * container.resolve(LogService)
   */
  resolve(identifier: ModuleIdentifier | Ctor, ...args: any[]): any {
    /** for injectable as identifier condition, currently only used by toParamsFactory */
    if (isInjectable(identifier))
      return instantiate(identifier as Ctor, this, ...args);
    const binding = this.getBinding(identifier);

    if (!binding) {
      return null;
    }

    if (binding.value != null) {
      return binding.value;
    }

    return instantiate(binding, this, ...args);
  }
}

export default Container;
