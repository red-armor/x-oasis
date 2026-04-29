/**
 * @module react
 *
 * React Query integration for async-call-rpc.
 *
 * Provides `createRPCReact()` — a factory that generates type-safe
 * React hooks (`useQuery`, `useMutation`, `useSubscription`) backed
 * by an RPC proxy client.
 *
 * Inspired by `@trpc/react-query`, but designed to work with the
 * existing `ProxyRPCClient.createProxy()` pattern without requiring
 * a tRPC router definition.
 *
 * @example
 * ```tsx
 * // 1. Define your service interface
 * interface FileService {
 *   readFile(path: string): Promise<string>;
 *   writeFile(path: string, content: string): Promise<void>;
 *   listFiles(dir: string): Promise<string[]>;
 * }
 *
 * // 2. Create the hooks
 * const fileRPC = createRPCReact<FileService>(fileClient);
 *
 * // 3. Use in components
 * function FileViewer({ path }: { path: string }) {
 *   const { data, isLoading } = fileRPC.useQuery('readFile', [path]);
 *   const writeMutation = fileRPC.useMutation('writeFile');
 *
 *   return <pre>{data}</pre>;
 * }
 * ```
 *
 * **Requirements**: `@tanstack/react-query` must be installed as a peer dependency.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
  UseQueryResult,
  UseMutationResult,
} from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import ProxyRPCClient from './endpoint/ProxyRPCClient';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

/**
 * Extract the methods from a service interface that return a Promise.
 */
type AsyncMethods<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => Promise<any> ? K : never;
}[keyof T] &
  string;

/**
 * Extract parameter types for a given method.
 */
type MethodArgs<T, K extends keyof T> = T[K] extends (...args: infer A) => any
  ? A
  : never;

/**
 * Extract the resolved return type for a given method.
 */
type MethodResult<T, K extends keyof T> = T[K] extends (
  ...args: any[]
) => Promise<infer R>
  ? R
  : T[K] extends (...args: any[]) => infer R
  ? R
  : never;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface RPCReactHooks<
  T extends Record<string, (...args: any[]) => any>
> {
  /**
   * React Query `useQuery` hook bound to an RPC method.
   *
   * The `queryKey` is automatically derived from `[requestPath, method, ...args]`,
   * so cache invalidation and deduplication work out of the box.
   *
   * @param method - The RPC method name to call.
   * @param args   - Arguments forwarded to the remote method.
   * @param options - Standard `@tanstack/react-query` `UseQueryOptions` (minus `queryKey` and `queryFn`).
   */
  useQuery: <K extends AsyncMethods<T>>(
    method: K,
    args: MethodArgs<T, K>,
    options?: Omit<
      UseQueryOptions<MethodResult<T, K>, Error>,
      'queryKey' | 'queryFn'
    >
  ) => UseQueryResult<MethodResult<T, K>, Error>;

  /**
   * React Query `useMutation` hook bound to an RPC method.
   *
   * @param method  - The RPC method name to call.
   * @param options - Standard `@tanstack/react-query` `UseMutationOptions`.
   */
  useMutation: <K extends AsyncMethods<T>>(
    method: K,
    options?: Omit<
      UseMutationOptions<MethodResult<T, K>, Error, MethodArgs<T, K>>,
      'mutationFn'
    >
  ) => UseMutationResult<MethodResult<T, K>, Error, MethodArgs<T, K>>;

  /**
   * Subscribe to an event-style RPC method (e.g. `onFileChanged`).
   *
   * Pushes each received value into the React Query cache so that
   * `useQuery` consumers automatically re-render.
   *
   * @param method  - The `on*` event method name.
   * @param args    - Arguments forwarded to the subscription setup.
   * @param options - `{ enabled }` to conditionally subscribe.
   */
  useSubscription: <K extends AsyncMethods<T>>(
    method: K,
    args: MethodArgs<T, K>,
    options?: { enabled?: boolean }
  ) => void;

  /**
   * Build a `queryKey` for a given method + args.
   * Useful for manual `queryClient.invalidateQueries()`.
   *
   * @example
   * ```ts
   * queryClient.invalidateQueries({
   *   queryKey: fileRPC.getQueryKey('readFile', 'README.md'),
   * });
   * ```
   */
  getQueryKey: <K extends AsyncMethods<T>>(
    method: K,
    ...args: MethodArgs<T, K>
  ) => readonly [string, K, ...MethodArgs<T, K>];

  /**
   * The underlying typed proxy instance.
   */
  proxy: T;
}

/**
 * Create type-safe React hooks for an RPC client.
 *
 * @param client - A `ProxyRPCClient` instance with the channel already set.
 * @returns An object with `useQuery`, `useMutation`, `useSubscription`,
 *          `getQueryKey`, and the raw `proxy`.
 */
export function createRPCReact<
  T extends Record<string, (...args: any[]) => any>
>(client: ProxyRPCClient): RPCReactHooks<T> {
  const proxy = client.createProxy<T>();
  const requestPath = client.requestPath;

  const getQueryKey = <K extends AsyncMethods<T>>(
    method: K,
    ...args: MethodArgs<T, K>
  ): readonly [string, K, ...MethodArgs<T, K>] => {
    return [requestPath, method, ...args] as const as any;
  };

  return {
    useQuery: (method, args, options) => {
      return useQuery({
        queryKey: [requestPath, method, ...args] as any,
        queryFn: () => (proxy as any)[method](...args),
        ...options,
      });
    },

    useMutation: (method, options) => {
      return useMutation({
        mutationFn: (args: any) => (proxy as any)[method](...args),
        ...options,
      });
    },

    useSubscription: (method, args, options) => {
      const queryClient = useQueryClient();
      const enabledRef = useRef(options?.enabled ?? true);
      enabledRef.current = options?.enabled ?? true;

      useEffect(() => {
        if (!enabledRef.current) return undefined;

        // Use the proper subscription API if available on the client,
        // otherwise fall back to direct proxy call (for `on*` event methods).
        const sub = client.subscribe(method, args as any[], {
          onData: (value: any) => {
            queryClient.setQueryData([requestPath, method, ...args], value);
          },
          onError: (err: Error) => {
            console.error(`[useSubscription] Error in ${method}:`, err);
          },
        });

        return () => {
          sub.unsubscribe();
          queryClient.removeQueries({
            queryKey: [requestPath, method, ...args],
          });
        };
      }, [method, ...args]);
    },

    getQueryKey,
    proxy,
  };
}
