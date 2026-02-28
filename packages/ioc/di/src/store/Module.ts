import {
  DecoratorTarget,
  ModuleConstructorDepToken,
  ModuleIdentifier,
  ModulePropertyDepToken,
  ModuleProps,
  RegistryType,
} from '../types';

export default class Module {
  private _constructorDeps: ModuleConstructorDepToken[] = [];

  private _propertyDeps: ModulePropertyDepToken[] = [];

  private _target: DecoratorTarget;

  // private readonly _id: string

  private readonly _registryType: RegistryType;

  constructor(props: ModuleProps) {
    this._target = props.target;
    // this._id = props.id
    this._registryType = props.registryType || RegistryType.Injected;
    this.addConstructorDependency = this.addConstructorDependency.bind(this);
    this.addPropertyDependency = this.addPropertyDependency.bind(this);
  }

  get target() {
    return this._target;
  }

  set target(value: DecoratorTarget) {
    this._target = value;
  }

  // get id() {
  //   return this._id
  // }

  get registryType() {
    return this._registryType;
  }

  addPropertyDependency(id: ModuleIdentifier, propertyName: string) {
    const token = { id, propertyName };
    this._propertyDeps.push(token);
  }

  addConstructorDependency(id: ModuleIdentifier, index: number) {
    const token = { id, index };
    this._constructorDeps.push(token);
  }

  get constructorDeps() {
    return this._constructorDeps;
  }

  get propertyDeps() {
    return this._propertyDeps;
  }
}
