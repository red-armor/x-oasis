import { IS_INJECTABLE, createHiddenProperty } from '../common';
import * as ERRORS_MSGS from '../constants/error';
import { registerModule, store } from '../store';
import { DecoratorTarget, RegistryType } from '../types';

function injectable() {
  return function <T extends DecoratorTarget>(target: T) {
    const module = store.getTargetModule(target);

    if (module && module.registryType === RegistryType.Injected) {
      // module.target = target
      // registerModule(target, RegistryType.Injected)
      // createHiddenProperty(target, IS_INJECTABLE, true)
      // return target
      // // return module.target
      throw new Error(ERRORS_MSGS.DUPLICATED_INJECTABLE_DECORATOR);
    }

    if (module && module.target) return module.target as any;

    registerModule(target, RegistryType.Injected);
    createHiddenProperty(target, IS_INJECTABLE, true);

    return target;
  };
}

export { injectable };
