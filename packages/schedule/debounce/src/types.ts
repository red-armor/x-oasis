type ResolveArgs = (...args: [any]) => any;

export type Options = {
  leading: boolean;
  trailing: boolean;
  maxTime: number;
  resetTime: number;
  resolveArgs: ResolveArgs;
};
