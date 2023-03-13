import { getOrCreate } from './utils';

type MakeAsync<Function_> = Function_ extends (
  this: infer This,
  ...parameters: infer Arguments
) => infer Return
  ? (this: This, ...parameters: Arguments) => Return | Promise<Return>
  : never;

export type ObjectHook<T, O = {}> =
  | T
  | ({ handler: T; order?: 'pre' | 'post' | null } & O);

export interface OutputPlugin {
  name: string;
}

// export interface CoPlugin<
//   FunctionPluginHooks,
//   AsyncPluginHooks,
//   ParallelPluginHooks
// > extends OutputPlugin,
//     Partial<
//       PluginHooks<FunctionPluginHooks, AsyncPluginHooks, ParallelPluginHooks>
//     > {}

export type HookAction = [plugin: string, hook: string, args: unknown[]];

// new PluginDriver<
//   { onSu: () => any; in: (a: string) => string },
//   'onSu',
//   'onSu',
//   'onSu'
// >().hookParallel('in', ['a']);

// type a = 'a' | 'ab';
// type bb = a;

// type A<FunctionPluginHooks extends Record<string, (...args: any[]) => any>> =
//   keyof FunctionPluginHooks;
// type b = A<{ a: () => string }>;
export class PluginDriver<
  FunctionPluginHooks extends
    | Record<string, (...args: any[]) => any>
    | { [key: string]: (...args: any[]) => any },
  SyncPluginHooks extends Partial<keyof FunctionPluginHooks>,
  SequentialPluginHooks extends Partial<keyof FunctionPluginHooks>,
  FirstPluginHooks extends Partial<keyof FunctionPluginHooks>,
  ParallelPluginHooks extends Exclude<
    keyof FunctionPluginHooks,
    FirstPluginHooks
  > = Exclude<keyof FunctionPluginHooks, FirstPluginHooks>,
  AsyncPluginHooks extends Exclude<
    keyof FunctionPluginHooks,
    SyncPluginHooks
  > = Exclude<keyof FunctionPluginHooks, SyncPluginHooks>,
  PluginHooks = {
    [K in keyof FunctionPluginHooks]: ObjectHook<
      K extends AsyncPluginHooks
        ? MakeAsync<FunctionPluginHooks[K]>
        : FunctionPluginHooks[K],
      // eslint-disable-next-line @typescript-eslint/ban-types
      K extends ParallelPluginHooks ? { sequential?: boolean } : {}
    >;
  },
  CoPlugin extends OutputPlugin = Partial<PluginHooks> & OutputPlugin
> {
  private readonly sortedPlugins = new Map<AsyncPluginHooks, CoPlugin[]>();
  private plugins: CoPlugin[] = [];
  private readonly unfulfilledActions = new Set<HookAction>();
  constructor({ plugins = [] }: { plugins?: CoPlugin[] } = {}) {
    this.plugins ??= plugins;
  }

  setPlugins(plugins: CoPlugin[]) {
    this.plugins = plugins;
    this.sortedPlugins.clear();
  }

  resetPlugins() {
    this.plugins = [];
    this.sortedPlugins.clear();
  }

  addPlugin(plugin: CoPlugin) {
    this.plugins.push(plugin);
    this.sortedPlugins.clear();
  }

  getPlugins(): CoPlugin[] {
    return this.plugins;
  }

  // chains, first non-null result stops and returns
  hookFirst<H extends AsyncPluginHooks & FirstPluginHooks>(
    hookName: H,
    parameters: Parameters<FunctionPluginHooks[H]>,
    skipped?: ReadonlySet<CoPlugin> | null
  ): Promise<ReturnType<FunctionPluginHooks[H]> | null> {
    let promise: Promise<ReturnType<FunctionPluginHooks[H]> | null> =
      Promise.resolve(null);
    for (const plugin of this.getSortedPlugins(hookName)) {
      if (skipped && skipped.has(plugin)) continue;
      // @ts-ignore
      promise = promise.then((result) => {
        if (result != null) return result;
        return this.runHook(hookName, parameters, plugin);
      });
    }
    return promise;
  }

  // chains synchronously, first non-null result stops and returns
  hookFirstSync<H extends SyncPluginHooks & FirstPluginHooks>(
    hookName: H,
    parameters: Parameters<FunctionPluginHooks[H]>
  ): ReturnType<FunctionPluginHooks[H]> | null {
    for (const plugin of this.getSortedPlugins(hookName)) {
      const result = this.runHookSync(hookName, parameters, plugin);
      if (result != null) return result;
    }
    return null;
  }

  async hookParallel<H extends AsyncPluginHooks & ParallelPluginHooks>(
    hookName: H,
    parameters: Parameters<FunctionPluginHooks[H]>
  ): Promise<void> {
    const parallelPromises: Promise<unknown>[] = [];
    for (const plugin of this.getSortedPlugins(hookName)) {
      if (((plugin as any)[hookName] as { sequential?: boolean }).sequential) {
        await Promise.all(parallelPromises);
        parallelPromises.length = 0;
        await this.runHook(hookName, parameters, plugin);
      } else {
        parallelPromises.push(this.runHook(hookName, parameters, plugin));
      }
    }
    await Promise.all(parallelPromises);
  }

  private getSortedPlugins(hookName: keyof FunctionPluginHooks): CoPlugin[] {
    this.sortedPlugins.clear();

    return getOrCreate(this.sortedPlugins, hookName, () =>
      this.getSortedValidatedPlugins(hookName, this.plugins)
    );
  }

  private runHook<H extends AsyncPluginHooks>(
    hookName: H,
    parameters: unknown[],
    plugin: CoPlugin
  ): Promise<unknown> {
    // We always filter for plugins that support the hook before running it
    const hook = (plugin as any)[hookName]! as ObjectHook<
      FunctionPluginHooks[H]
    >;
    const handler = typeof hook === 'object' ? hook.handler : hook;

    // TODO
    const context = null;

    let action: [string, string, Parameters<any>] | null = null;
    return Promise.resolve()
      .then(() => {
        if (typeof handler !== 'function') {
          return handler;
        }
        // eslint-disable-next-line @typescript-eslint/ban-types
        const hookResult = (handler as Function).apply(context, parameters);

        if (!hookResult?.then) {
          // short circuit for non-thenables and non-Promises
          return hookResult;
        }

        // Track pending hook actions to properly error out when
        // unfulfilled promises cause rollup to abruptly and confusingly
        // exit with a successful 0 return code but without producing any
        // output, errors or warnings.
        action = [plugin.name, hookName as string, parameters];
        this.unfulfilledActions.add(action);

        // Although it would be more elegant to just return hookResult here
        // and put the .then() handler just above the .catch() handler below,
        // doing so would subtly change the defacto async event dispatch order
        // which at least one test and some plugins in the wild may depend on.
        return Promise.resolve(hookResult).then((result) => {
          // action was fulfilled
          this.unfulfilledActions.delete(action!);
          return result;
        });
      })
      .catch((error_) => {
        if (action !== null) {
          // action considered to be fulfilled since error being handled
          this.unfulfilledActions.delete(action);
        }
        // return error(errorPluginError(error_, plugin.name, { hook: hookName }))
        // TODO
        // console.error(error_)

        throw error_;
      });
  }

  private runHookSync<H extends SyncPluginHooks>(
    hookName: H,
    parameters: Parameters<FunctionPluginHooks[H]>,
    plugin: CoPlugin
  ): ReturnType<FunctionPluginHooks[H]> {
    const hook = (plugin as any)[hookName]! as ObjectHook<
      FunctionPluginHooks[H]
    >;
    const handler = typeof hook === 'object' ? hook.handler : hook;

    const context = null;

    try {
      // eslint-disable-next-line @typescript-eslint/ban-types
      return (handler as Function).apply(context, parameters);
    } catch (error_: any) {
      // return error(errorPluginError(error_, plugin.name, { hook: hookName }))
      // TODO
      console.error(error_);
      throw error_;
    }
  }

  hookReduceValueSync<H extends SyncPluginHooks & SequentialPluginHooks, T>(
    hookName: H,
    initialValue: T,
    parameters: Parameters<FunctionPluginHooks[H]>,
    reduce: (
      reduction: T,
      result: ReturnType<FunctionPluginHooks[H]>,
      plugin: CoPlugin
    ) => T
  ): T {
    let accumulator = initialValue;
    const context = null;
    for (const plugin of this.getSortedPlugins(hookName)) {
      const result = this.runHookSync(hookName, parameters, plugin);
      accumulator = reduce.call(context, accumulator, result, plugin);
    }
    return accumulator;
  }

  hookSeq<H extends AsyncPluginHooks & SequentialPluginHooks>(
    hookName: H,
    parameters: Parameters<FunctionPluginHooks[H]>
  ): Promise<void> {
    let promise: Promise<unknown> = Promise.resolve();
    for (const plugin of this.getSortedPlugins(hookName)) {
      promise = promise.then(() => this.runHook(hookName, parameters, plugin));
    }
    return promise.then(noop);
  }

  private getSortedValidatedPlugins(
    hookName: keyof FunctionPluginHooks,
    plugins: readonly CoPlugin[]
  ): CoPlugin[] {
    const pre: CoPlugin[] = [];
    const normal: CoPlugin[] = [];
    const post: CoPlugin[] = [];
    for (const plugin of plugins) {
      const hook = (plugin as any)[hookName];
      if (hook) {
        if (typeof hook === 'object') {
          // validateHandler(hook.handler, hookName, plugin)
          if (hook.order === 'pre') {
            pre.push(plugin);
            continue;
          }
          if (hook.order === 'post') {
            post.push(plugin);
            continue;
          }
        } else {
          // validateHandler(hook, hookName, plugin)
        }
        normal.push(plugin);
      }
    }
    return [...pre, ...normal, ...post];
  }
}
function noop() {}
