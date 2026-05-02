import { expect, describe, test, vi, beforeEach } from 'vitest';
import ProxyRPCClient from '../src/endpoint/ProxyRPCClient';
import RPCService from '../src/endpoint/RPCService';
import RPCServiceHost from '../src/endpoint/RPCServiceHost';
import clientHost from '../src/endpoint/RPCClientHost';
import AbstractChannelProtocol from '../src/protocol/AbstractChannelProtocol';

/**
 * Test suite for RPC Endpoint classes
 * Covers: ProxyRPCClient, RPCService, RPCServiceHost, and RPCClientHost
 */
describe('RPC Endpoint Classes', () => {
  let mockChannel: Partial<AbstractChannelProtocol>;

  beforeEach(() => {
    mockChannel = {
      makeRequest: vi.fn().mockResolvedValue('result'),
      on: vi.fn(),
      onMessage: vi.fn(),
      setService: vi.fn(),
      ensureListenerAttached: vi.fn(),
    };
  });

  describe('ProxyRPCClient', () => {
    let client: ProxyRPCClient;

    beforeEach(() => {
      client = new ProxyRPCClient('/myservice');
    });

    test('should create client with request path', () => {
      expect(client.requestPath).toBe('/myservice');
    });

    test('should set channel', () => {
      client.setChannel(mockChannel as AbstractChannelProtocol);
      expect(mockChannel.ensureListenerAttached).toHaveBeenCalled();
    });

    test('should throw if channel is not set when calling method', () => {
      const proxy = client.createProxy();
      expect(() => {
        proxy.someMethod();
      }).toThrow('[ProxyRPCClient] Channel is not set');
    });

    test('should create proxy and call regular method', () => {
      client.setChannel(mockChannel as AbstractChannelProtocol);
      const proxy = client.createProxy();

      proxy.regularMethod('arg1', 'arg2');

      expect(mockChannel.makeRequest).toHaveBeenCalledWith({
        requestPath: '/myservice',
        methodName: 'regularMethod',
        args: ['arg1', 'arg2'],
      });
    });

    test('should create proxy and call event method (onXxx)', () => {
      client.setChannel(mockChannel as AbstractChannelProtocol);
      const proxy = client.createProxy();

      const callback = vi.fn();
      proxy.onPing(callback);

      expect(mockChannel.makeRequest).toHaveBeenCalledWith({
        requestPath: '/myservice',
        methodName: 'onPing',
        args: [],
      });
    });

    test('should support client created with channel option', () => {
      const clientWithChannel = new ProxyRPCClient('/service', {
        channel: mockChannel as AbstractChannelProtocol,
      });

      expect(mockChannel.ensureListenerAttached).toHaveBeenCalled();
    });
  });

  describe('RPCService', () => {
    let serviceHost: RPCServiceHost;
    let service: RPCService;

    beforeEach(() => {
      serviceHost = new RPCServiceHost();
      service = new RPCService('/testservice', {
        channel: mockChannel as AbstractChannelProtocol,
        handlers: {
          method1: vi.fn().mockResolvedValue('result1'),
          method2: vi.fn().mockResolvedValue('result2'),
        },
        serviceHost,
      });
    });

    test('should create service with path and handlers', () => {
      expect(service.servicePath).toBe('/testservice');
      expect(service.handlersMap.size).toBe(2);
    });

    test('should register handler', () => {
      const handler = vi.fn();
      service.registerHandler('newMethod', handler);

      expect(service.getHandler('newMethod')).toBe(handler);
    });

    test('should get registered handler', () => {
      const handler = service.getHandler('method1');
      expect(handler).toBeDefined();
    });

    test('should return undefined for non-existent handler', () => {
      const handler = service.getHandler('nonExistent');
      expect(handler).toBeUndefined();
    });

    test('should set channel', () => {
      const newChannel = {
        setService: vi.fn(),
        ensureListenerAttached: vi.fn(),
      };
      service.setChannel(newChannel as unknown as AbstractChannelProtocol);

      expect(newChannel.setService).toHaveBeenCalledWith(service);
      expect(newChannel.ensureListenerAttached).toHaveBeenCalled();
    });

    test('should register multiple handlers at once', () => {
      const handlers = {
        add: (a: number, b: number) => a + b,
        subtract: (a: number, b: number) => a - b,
        multiply: (a: number, b: number) => a * b,
      };

      service.registerHandlers(handlers);

      expect(service.getHandler('add')).toBeDefined();
      expect(service.getHandler('subtract')).toBeDefined();
      expect(service.getHandler('multiply')).toBeDefined();
    });

    test('should handle merge operation', () => {
      const otherService = new RPCService('/other', {
        channel: mockChannel as AbstractChannelProtocol,
        handlers: {},
        serviceHost,
      });

      expect(() => service.merge(otherService)).not.toThrow();
    });

    test('should not throw when registering handlers with undefined', () => {
      const emptyService = new RPCService('/empty', {
        channel: mockChannel as AbstractChannelProtocol,
        handlers: {},
        serviceHost,
      });

      expect(() => emptyService.registerHandlers(undefined)).not.toThrow();
      expect(emptyService.handlersMap.size).toBe(0);
    });
  });

  describe('RPCServiceHost', () => {
    let serviceHost: RPCServiceHost;

    beforeEach(() => {
      serviceHost = new RPCServiceHost();
    });

    test('should register service', () => {
      serviceHost.registerService('/myservice', {
        channel: mockChannel as AbstractChannelProtocol,
        handlers: { test: vi.fn() },
        serviceHost,
      });

      const service = serviceHost.getService('/myservice');
      expect(service).toBeDefined();
      expect(service?.servicePath).toBe('/myservice');
    });

    test('should get registered service', () => {
      serviceHost.registerService('/myservice', {
        channel: mockChannel as AbstractChannelProtocol,
        handlers: { test: vi.fn() },
        serviceHost,
      });

      const service = serviceHost.getService('/myservice');
      expect(service).toBeDefined();
      expect(service?.servicePath).toBe('/myservice');
    });

    test('should return undefined for non-registered service', () => {
      const service = serviceHost.getService('/nonexistent');
      expect(service).toBeUndefined();
    });

    test('should get handler from service', () => {
      const handler = vi.fn();
      serviceHost.registerService('/myservice', {
        channel: mockChannel as AbstractChannelProtocol,
        handlers: { myMethod: handler },
        serviceHost,
      });

      const retrievedHandler = serviceHost.getHandler('/myservice', 'myMethod');
      expect(retrievedHandler).toBe(handler);
    });

    test('should return undefined when getting handler from non-existent service', () => {
      const handler = serviceHost.getHandler('/nonexistent', 'method');
      expect(handler).toBeUndefined();
    });

    test('should register multiple services', () => {
      serviceHost.registerService('/service1', {
        channel: mockChannel as AbstractChannelProtocol,
        handlers: { test: vi.fn() },
        serviceHost,
      });
      serviceHost.registerService('/service2', {
        channel: mockChannel as AbstractChannelProtocol,
        handlers: { test: vi.fn() },
        serviceHost,
      });

      expect(serviceHost.getService('/service1')).toBeDefined();
      expect(serviceHost.getService('/service2')).toBeDefined();
    });
  });

  describe('RPCClientHost', () => {
    beforeEach(() => {
      clientHost['hostMap'].clear();
    });

    test('should register client', () => {
      const client = clientHost.registerClient('/client1', {
        channel: mockChannel as AbstractChannelProtocol,
      });

      expect(client.requestPath).toBe('/client1');
    });

    test('should get registered client', () => {
      clientHost.registerClient('/client1', {
        channel: mockChannel as AbstractChannelProtocol,
      });

      const client = clientHost.getClient('/client1');
      expect(client).toBeDefined();
      expect(client?.requestPath).toBe('/client1');
    });

    test('should return undefined for non-registered client', () => {
      const client = clientHost.getClient('/nonexistent');
      expect(client).toBeUndefined();
    });

    test('should remove client', () => {
      clientHost.registerClient('/client1', {
        channel: mockChannel as AbstractChannelProtocol,
      });

      const removed = clientHost.removeClient('/client1');
      expect(removed).toBe(true);

      const client = clientHost.getClient('/client1');
      expect(client).toBeUndefined();
    });

    test('should return false when removing non-existent client', () => {
      const removed = clientHost.removeClient('/nonexistent');
      expect(removed).toBe(false);
    });

    test('should support multiple clients', () => {
      clientHost.registerClient('/client1', {
        channel: mockChannel as AbstractChannelProtocol,
      });
      clientHost.registerClient('/client2', {
        channel: mockChannel as AbstractChannelProtocol,
      });

      expect(clientHost.getClient('/client1')).toBeDefined();
      expect(clientHost.getClient('/client2')).toBeDefined();
    });
  });
});
