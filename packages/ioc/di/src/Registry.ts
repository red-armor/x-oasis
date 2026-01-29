import Container from './Container';
import { RegistryFactory, RegistryOptions } from './types';

class Registry {
  private readonly registryFactory: RegistryFactory;

  private readonly registryOptions: RegistryOptions;

  constructor(
    registryFactory: RegistryFactory,
    registryOptions?: RegistryOptions
  ) {
    this.registryFactory = registryFactory;
    this.registryOptions = registryOptions || {};
  }

  load(container: Container) {
    this.registryFactory(container.bind.bind(container));
  }
}

export default Registry;
