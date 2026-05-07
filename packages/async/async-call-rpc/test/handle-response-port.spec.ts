import { expect, test, describe, vi, beforeEach } from 'vitest';
import { handleResponse } from '../src/middlewares/handleResponse';
import { ResponseType } from '../src/types';
import AbstractChannelProtocol from '../src/protocol/AbstractChannelProtocol';
import { createDeferred, Deferred } from '@x-oasis/deferred';

/**
 * Tests for handleResponse's PortSuccess and PortArraySuccess branches.
 *
 * These verify the CLIENT-SIDE resolution logic:
 *   - PortSuccess      → resolve(ports[0])   (single Transferable)
 *   - PortArraySuccess  → resolve(ports)      (array of Transferables)
 *
 * Complements the handleRequest tests in port-return.spec.ts which verify
 * the SERVER-SIDE generation of these ResponseTypes.
 */
describe('handleResponse PortSuccess / PortArraySuccess', () => {
  let mockProtocol: Partial<AbstractChannelProtocol>;
  let ongoingRequests: Map<string, Deferred>;

  beforeEach(() => {
    ongoingRequests = new Map();
    mockProtocol = {
      ongoingRequests,
      subscriptions: new Map(),
      requestEvents: new Map(),
    };
  });

  // --- PortSuccess ---

  test('PortSuccess resolves with ports[0] (single Transferable)', async () => {
    const deferred = createDeferred();
    ongoingRequests.set('seq-1', deferred);

    const fakePort = { postMessage: vi.fn(), start: vi.fn() };

    const run = handleResponse(mockProtocol as AbstractChannelProtocol);
    run({
      data: [[ResponseType.PortSuccess, 'seq-1'], []],
      ports: [fakePort],
    } as any);

    const result = await deferred.promise;
    expect(result).toBe(fakePort);
    expect(ongoingRequests.has('seq-1')).toBe(false);
  });

  test('PortSuccess with multiple ports still resolves with ports[0]', async () => {
    const deferred = createDeferred();
    ongoingRequests.set('seq-2', deferred);

    const fakePort1 = { postMessage: vi.fn(), start: vi.fn() };
    const fakePort2 = { postMessage: vi.fn(), start: vi.fn() };

    const run = handleResponse(mockProtocol as AbstractChannelProtocol);
    run({
      data: [[ResponseType.PortSuccess, 'seq-2'], []],
      ports: [fakePort1, fakePort2],
    } as any);

    const result = await deferred.promise;
    expect(result).toBe(fakePort1);
  });

  test('PortSuccess with empty ports resolves with undefined', async () => {
    const deferred = createDeferred();
    ongoingRequests.set('seq-3', deferred);

    const run = handleResponse(mockProtocol as AbstractChannelProtocol);
    run({
      data: [[ResponseType.PortSuccess, 'seq-3'], []],
      ports: [],
    } as any);

    const result = await deferred.promise;
    expect(result).toBeUndefined();
  });

  test('PortSuccess with undefined ports resolves with undefined', async () => {
    const deferred = createDeferred();
    ongoingRequests.set('seq-4', deferred);

    const run = handleResponse(mockProtocol as AbstractChannelProtocol);
    run({
      data: [[ResponseType.PortSuccess, 'seq-4'], []],
      ports: undefined,
    } as any);

    const result = await deferred.promise;
    expect(result).toBeUndefined();
  });

  // --- PortArraySuccess ---

  test('PortArraySuccess resolves with full ports array', async () => {
    const deferred = createDeferred();
    ongoingRequests.set('seq-5', deferred);

    const fakePort1 = { postMessage: vi.fn(), start: vi.fn() };
    const fakePort2 = { postMessage: vi.fn(), start: vi.fn() };

    const run = handleResponse(mockProtocol as AbstractChannelProtocol);
    run({
      data: [[ResponseType.PortArraySuccess, 'seq-5'], []],
      ports: [fakePort1, fakePort2],
    } as any);

    const result = (await deferred.promise) as any[];
    expect(result).toEqual([fakePort1, fakePort2]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(fakePort1);
    expect(result[1]).toBe(fakePort2);
    expect(ongoingRequests.has('seq-5')).toBe(false);
  });

  test('PortArraySuccess with single port resolves with [port]', async () => {
    const deferred = createDeferred();
    ongoingRequests.set('seq-6', deferred);

    const fakePort = { postMessage: vi.fn(), start: vi.fn() };

    const run = handleResponse(mockProtocol as AbstractChannelProtocol);
    run({
      data: [[ResponseType.PortArraySuccess, 'seq-6'], []],
      ports: [fakePort],
    } as any);

    const result = await deferred.promise;
    expect(result).toEqual([fakePort]);
    expect(result).toHaveLength(1);
  });

  test('PortArraySuccess with undefined ports resolves with empty array', async () => {
    const deferred = createDeferred();
    ongoingRequests.set('seq-7', deferred);

    const run = handleResponse(mockProtocol as AbstractChannelProtocol);
    run({
      data: [[ResponseType.PortArraySuccess, 'seq-7'], []],
      ports: undefined,
    } as any);

    const result = await deferred.promise;
    expect(result).toEqual([]);
  });

  test('PortArraySuccess with empty ports resolves with empty array', async () => {
    const deferred = createDeferred();
    ongoingRequests.set('seq-8', deferred);

    const run = handleResponse(mockProtocol as AbstractChannelProtocol);
    run({
      data: [[ResponseType.PortArraySuccess, 'seq-8'], []],
      ports: [],
    } as any);

    const result = await deferred.promise;
    expect(result).toEqual([]);
  });

  // --- Cleanup ---

  test('PortSuccess removes deferred from ongoingRequests', async () => {
    const deferred = createDeferred();
    ongoingRequests.set('seq-cleanup', deferred);
    expect(ongoingRequests.size).toBe(1);

    const run = handleResponse(mockProtocol as AbstractChannelProtocol);
    run({
      data: [[ResponseType.PortSuccess, 'seq-cleanup'], []],
      ports: [{ postMessage: vi.fn() }],
    } as any);

    await deferred.promise;
    expect(ongoingRequests.size).toBe(0);
  });

  test('PortArraySuccess removes deferred from ongoingRequests', async () => {
    const deferred = createDeferred();
    ongoingRequests.set('seq-cleanup-arr', deferred);
    expect(ongoingRequests.size).toBe(1);

    const run = handleResponse(mockProtocol as AbstractChannelProtocol);
    run({
      data: [[ResponseType.PortArraySuccess, 'seq-cleanup-arr'], []],
      ports: [{ postMessage: vi.fn() }],
    } as any);

    await deferred.promise;
    expect(ongoingRequests.size).toBe(0);
  });

  // --- Contrast with ReturnSuccess ---

  test('ReturnSuccess resolves with body[0], not ports', async () => {
    const deferred = createDeferred();
    ongoingRequests.set('seq-normal', deferred);

    const run = handleResponse(mockProtocol as AbstractChannelProtocol);
    run({
      data: [[ResponseType.ReturnSuccess, 'seq-normal'], [42]],
      ports: [{ postMessage: vi.fn() }],
    } as any);

    const result = await deferred.promise;
    expect(result).toBe(42);
  });
});
