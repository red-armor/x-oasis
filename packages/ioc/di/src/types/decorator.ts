export type IDecorator<T = Function> = {
  (target: T, key: string, index: number): void;
};

type Prototype<T> = {
  [Property in keyof T]: T[Property] extends NewableFunction
    ? T[Property]
    : T[Property] | undefined;
} & { constructor: NewableFunction };

interface ConstructorFunction<T = Record<string, unknown>> {
  new (...args: unknown[]): T;
  prototype?: Prototype<T>;
}

export type DecoratorTarget<T = unknown> = ConstructorFunction<T>;
