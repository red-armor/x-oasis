import { expect, describe, test, vi, beforeEach } from 'vitest';

import { createRPCReact } from '../src/index';

/**
 * `vi.hoisted` runs *before* `vi.mock` hoisting, so the returned fns
 * are available inside mock factories without triggering the
 * "Cannot access before initialization" error.
 */
const {
  mockUseEffect,
  mockUseRef,
  mockUseQuery,
  mockUseMutation,
  mockUseQueryClient,
} = vi.hoisted(() => ({
  mockUseEffect: vi.fn((fn: () => any) => {
    fn();
  }),
  mockUseRef: vi.fn((val: any) => ({ current: val })),
  mockUseQuery: vi.fn((options: any) => ({
    data: undefined,
    isLoading: true,
    error: null,
    queryKey: options.queryKey,
    queryFn: options.queryFn,
  })),
  mockUseMutation: vi.fn((options: any) => ({
    mutate: vi.fn(),
    isPending: false,
    mutationFn: options.mutationFn,
  })),
  mockUseQueryClient: vi.fn(() => ({
    setQueryData: vi.fn(),
    removeQueries: vi.fn(),
  })),
}));

// Mock react hooks
vi.mock('react', () => ({
  useEffect: mockUseEffect,
  useRef: mockUseRef,
}));

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useQueryClient: mockUseQueryClient,
}));

// Mock @x-oasis/async-call-rpc
vi.mock('@x-oasis/async-call-rpc', () => ({
  ProxyRPCClient: vi.fn(),
}));

/**
 * Test suite for createRPCReact
 * Covers: factory creation, useQuery, useMutation, useSubscription, getQueryKey, proxy
 */
describe('createRPCReact', () => {
  let mockClient: any;
  let mockProxy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockProxy = {
      readFile: vi.fn().mockResolvedValue('file content'),
      writeFile: vi.fn().mockResolvedValue(undefined),
      listFiles: vi.fn().mockResolvedValue(['a.txt', 'b.txt']),
    };

    mockClient = {
      requestPath: '/file-service',
      createProxy: vi.fn().mockReturnValue(mockProxy),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    };
  });

  describe('createRPCReact factory', () => {
    test('should create hooks object', () => {
      const hooks = createRPCReact(mockClient);

      expect(hooks).toHaveProperty('useQuery');
      expect(hooks).toHaveProperty('useMutation');
      expect(hooks).toHaveProperty('useSubscription');
      expect(hooks).toHaveProperty('getQueryKey');
      expect(hooks).toHaveProperty('proxy');
    });

    test('should create proxy from client', () => {
      createRPCReact(mockClient);

      expect(mockClient.createProxy).toHaveBeenCalled();
    });

    test('should expose the proxy', () => {
      const hooks = createRPCReact(mockClient);

      expect(hooks.proxy).toBe(mockProxy);
    });
  });

  describe('getQueryKey', () => {
    test('should generate query key with requestPath, method, and args', () => {
      const hooks = createRPCReact(mockClient);

      const key = hooks.getQueryKey('readFile' as any, '/path/to/file' as any);

      expect(key[0]).toBe('/file-service');
      expect(key[1]).toBe('readFile');
      expect(key[2]).toBe('/path/to/file');
    });

    test('should generate key without extra args', () => {
      const hooks = createRPCReact(mockClient);

      const key = hooks.getQueryKey('listFiles' as any, '/src' as any);

      expect(key[0]).toBe('/file-service');
      expect(key[1]).toBe('listFiles');
    });
  });

  describe('useQuery', () => {
    test('should call react-query useQuery with correct queryKey', () => {
      const hooks = createRPCReact(mockClient);

      hooks.useQuery('readFile' as any, ['/path'] as any);

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['/file-service', 'readFile', '/path'],
        })
      );
    });

    test('should call react-query useQuery with queryFn', () => {
      const hooks = createRPCReact(mockClient);

      hooks.useQuery('readFile' as any, ['/path'] as any);

      const call = mockUseQuery.mock.calls[0][0];
      expect(call.queryFn).toBeTypeOf('function');
    });

    test('should pass additional options', () => {
      const hooks = createRPCReact(mockClient);

      hooks.useQuery(
        'readFile' as any,
        ['/path'] as any,
        {
          enabled: false,
          staleTime: 5000,
        } as any
      );

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
          staleTime: 5000,
        })
      );
    });
  });

  describe('useMutation', () => {
    test('should call react-query useMutation with mutationFn', () => {
      const hooks = createRPCReact(mockClient);

      hooks.useMutation('writeFile' as any);

      expect(mockUseMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          mutationFn: expect.any(Function),
        })
      );
    });

    test('should pass additional mutation options', () => {
      const hooks = createRPCReact(mockClient);
      const onSuccess = vi.fn();

      hooks.useMutation('writeFile' as any, { onSuccess } as any);

      expect(mockUseMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          onSuccess,
        })
      );
    });
  });

  describe('useSubscription', () => {
    test('should call client.subscribe when enabled', () => {
      const hooks = createRPCReact(mockClient);

      hooks.useSubscription('readFile' as any, ['/watch'] as any);

      expect(mockClient.subscribe).toHaveBeenCalledWith(
        'readFile',
        ['/watch'],
        expect.objectContaining({
          onData: expect.any(Function),
          onError: expect.any(Function),
        })
      );
    });

    test('should not subscribe when enabled is false', () => {
      const hooks = createRPCReact(mockClient);

      hooks.useSubscription('readFile' as any, ['/watch'] as any, {
        enabled: false,
      });

      expect(mockClient.subscribe).not.toHaveBeenCalled();
    });
  });
});
