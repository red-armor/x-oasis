export type ResolveArgs = (...args: any[]) => any;

export type Options = {
  leading: boolean;
  trailing: boolean;
  maxTimeout: number;
  resetTimeout: number;
  resolveArgs: ResolveArgs;
};
