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
import { ProxyRPCClient } from '@x-oasis/async-call-rpc/core';

type AsyncMethods<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => Promise<any> ? K : never;
}[keyof T] &
  string;

type MethodArgs<T, K extends keyof T> = T[K] extends (...args: infer A) => any
  ? A
  : never;

type MethodResult<T, K extends keyof T> = T[K] extends (
  ...args: any[]
) => Promise<infer R>
  ? R
  : T[K] extends (...args: any[]) => infer R
  ? R
  : never;

export interface RPCReactHooks<
  T extends Record<string, (...args: any[]) => any>
> {
  useQuery: <K extends AsyncMethods<T>>(
    method: K,
    args: MethodArgs<T, K>,
    options?: Omit<
      UseQueryOptions<MethodResult<T, K>, Error>,
      'queryKey' | 'queryFn'
    >
  ) => UseQueryResult<MethodResult<T, K>, Error>;

  useMutation: <K extends AsyncMethods<T>>(
    method: K,
    options?: Omit<
      UseMutationOptions<MethodResult<T, K>, Error, MethodArgs<T, K>>,
      'mutationFn'
    >
  ) => UseMutationResult<MethodResult<T, K>, Error, MethodArgs<T, K>>;

  useSubscription: <K extends AsyncMethods<T>>(
    method: K,
    args: MethodArgs<T, K>,
    options?: { enabled?: boolean }
  ) => void;

  getQueryKey: <K extends AsyncMethods<T>>(
    method: K,
    ...args: MethodArgs<T, K>
  ) => readonly [string, K, ...any[]];

  proxy: T;
}

export function createRPCReact<
  T extends Record<string, (...args: any[]) => any>
>(client: ProxyRPCClient): RPCReactHooks<T> {
  const proxy = client.createProxy<T>();
  const requestPath = client.requestPath;

  const getQueryKey = <K extends AsyncMethods<T>>(
    method: K,
    ...args: MethodArgs<T, K>
  ): readonly [string, K, ...any[]] => {
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
