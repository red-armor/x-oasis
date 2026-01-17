import {
  MiddlewareContext,
  PendingSendEntry,
  MiddlewareFunction,
  SendMiddlewareLifecycle,
} from '../../types';

export const resumeMiddlewares = (
  middlewares: any,
  entry: PendingSendEntry
) => {
  let start = false;

  return middlewares.reduce((a: any, b: MiddlewareFunction) => {
    if (!b.lifecycle) return a;
    if (a.lifecycle >= b.lifecycle && b.displayName === a.fnName) {
      start = true;
    }
    if (!start) return a;

    const targetLifecycle = a?.middlewareContext?.minLifecycle;
    const currentLifecycle = b?.lifecycle;

    // @ts-ignore
    if (
      targetLifecycle &&
      currentLifecycle &&
      currentLifecycle < targetLifecycle
    ) {
      return a;
    }

    return b(a);
  }, entry);
};

export const runMiddlewares = (
  middlewares: any,
  args: any[],
  _context?: MiddlewareContext
) => {
  const context = {
    isResumed: false,
    startLifecycle: SendMiddlewareLifecycle.Initial,
    minLifecycle: SendMiddlewareLifecycle.Initial,
    ...(_context || {}),
  };

  return middlewares.reduce((a: any, b: MiddlewareFunction, index: number) => {
    if (!index) return b(...a);
    if (index === 1) {
      a.middlewareContext = context;
    }

    const targetLifecycle = a?.middlewareContext?.minLifecycle;
    const currentLifecycle = b?.lifecycle;

    if (
      targetLifecycle &&
      currentLifecycle &&
      currentLifecycle < targetLifecycle
    ) {
      return a;
    }
    return b(a);
  }, args);
};
