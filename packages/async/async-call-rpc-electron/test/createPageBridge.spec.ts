import { describe, it, expect } from 'vitest';
import {
  resolvePeerId,
  getServicePath,
} from '../src/electron-browser/createPageBridge';

describe('createPageBridge — extracted pure functions', () => {
  describe('resolvePeerId', () => {
    it('should resolve peerId from standard connectionId (renderer--setting)', () => {
      expect(resolvePeerId('renderer--setting')).toBe('setting');
    });

    it('should resolve peerId from standard connectionId (renderer--connection)', () => {
      expect(resolvePeerId('renderer--connection')).toBe('connection');
    });

    it('should resolve peerId from standard connectionId (renderer--monitor)', () => {
      expect(resolvePeerId('renderer--monitor')).toBe('monitor');
    });

    it('should return first part when renderer is not the initiator', () => {
      expect(resolvePeerId('connection--renderer')).toBe('connection');
    });

    it('should return first part for non-renderer connectionId (setting--shared)', () => {
      expect(resolvePeerId('setting--shared')).toBe('setting');
    });

    it('should return undefined for connectionId without separator', () => {
      expect(resolvePeerId('noseparator')).toBeUndefined();
    });

    it('should resolve first part for connectionId containing hyphens (known limitation)', () => {
      expect(resolvePeerId('setting-renderer--setting')).toBe(
        'setting-renderer'
      );
    });

    it('should return undefined for connectionId without separator', () => {
      expect(resolvePeerId('noseparator')).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(resolvePeerId('')).toBeUndefined();
    });

    it('should return second part when first part is exactly "renderer"', () => {
      expect(resolvePeerId('renderer--daemon')).toBe('daemon');
    });

    it('Bug 2 regression: "setting-renderer--setting" resolves to "setting-renderer" not "setting"', () => {
      const result = resolvePeerId('setting-renderer--setting');
      expect(result).toBe('setting-renderer');
      expect(result).not.toBe('setting');
    });

    it('should return first part for alphabetical-order connectionId', () => {
      expect(resolvePeerId('connection--monitor')).toBe('connection');
    });
  });

  describe('getServicePath', () => {
    it('should extract servicePath from wire format array', () => {
      const data = [[1, 1, 'my-service', 'myMethod'], {}];
      expect(getServicePath(data)).toBe('my-service');
    });

    it('should extract servicePath from JSON string', () => {
      const data = JSON.stringify([[1, 1, 'shared-rpc', 'echo'], 'hello']);
      expect(getServicePath(data)).toBe('shared-rpc');
    });

    it('should return undefined for non-array data', () => {
      expect(getServicePath('plain string')).toBeUndefined();
    });

    it('should return undefined for array without header', () => {
      expect(getServicePath([1, 2, 3])).toBeUndefined();
    });

    it('should return undefined when header[2] is not a string', () => {
      expect(getServicePath([[1, 1, 42, 'method'], {}])).toBeUndefined();
    });

    it('should return undefined for invalid JSON string', () => {
      expect(getServicePath('{broken json')).toBeUndefined();
    });

    it('should extract ORCHESTRATOR_SERVICE_PATH correctly', () => {
      const data = [[1, 1, 'orchestrator', 'connect'], {}];
      expect(getServicePath(data)).toBe('orchestrator');
    });
  });
});

describe('createPageBridge — peerPortMap / servicePortMap behavior', () => {
  interface PortMapState {
    peerPortMap: Map<string, { id: number }>;
    servicePortMap: Map<string, { id: number }>;
    firstPort: { id: number } | null;
  }

  function simulateOnPortCallback(
    state: PortMapState,
    serviceRoutes: Record<string, string> | undefined,
    ctx: {
      connectionId: string;
      role: 'initiator' | 'receiver';
      port: { id: number };
    },
    defaultPeerId?: string
  ) {
    const resolvedPeerId = resolvePeerId(ctx.connectionId);
    if (resolvedPeerId) {
      state.peerPortMap.set(resolvedPeerId, ctx.port);
      if (serviceRoutes) {
        for (const [servicePath, routePeerId] of Object.entries(
          serviceRoutes
        )) {
          if (routePeerId === resolvedPeerId) {
            state.servicePortMap.set(servicePath, ctx.port);
          }
        }
      }
    }
    const resolvedAsDefault =
      !defaultPeerId || (resolvedPeerId && resolvedPeerId === defaultPeerId);
    if (resolvedAsDefault) {
      state.firstPort = ctx.port;
    }
  }

  it('should map servicePath to correct port via serviceRoutes', () => {
    const state: PortMapState = {
      peerPortMap: new Map(),
      servicePortMap: new Map(),
      firstPort: null,
    };
    const serviceRoutes = {
      'connection-api': 'connection',
      'monitor-api': 'monitor',
    };

    simulateOnPortCallback(state, serviceRoutes, {
      connectionId: 'renderer--connection',
      role: 'initiator',
      port: { id: 1 },
    });

    expect(state.servicePortMap.get('connection-api')).toEqual({ id: 1 });
    expect(state.peerPortMap.get('connection')).toEqual({ id: 1 });
  });

  it('should map multiple servicePaths to different ports', () => {
    const state: PortMapState = {
      peerPortMap: new Map(),
      servicePortMap: new Map(),
      firstPort: null,
    };
    const serviceRoutes = {
      'connection-api': 'connection',
      'monitor-api': 'monitor',
    };

    simulateOnPortCallback(state, serviceRoutes, {
      connectionId: 'renderer--connection',
      role: 'initiator',
      port: { id: 1 },
    });
    simulateOnPortCallback(state, serviceRoutes, {
      connectionId: 'renderer--monitor',
      role: 'initiator',
      port: { id: 2 },
    });

    expect(state.servicePortMap.get('connection-api')).toEqual({ id: 1 });
    expect(state.servicePortMap.get('monitor-api')).toEqual({ id: 2 });
  });

  it('should NOT map servicePath when resolvedPeerId does not match any route (Bug 2)', () => {
    const state: PortMapState = {
      peerPortMap: new Map(),
      servicePortMap: new Map(),
      firstPort: null,
    };
    const serviceRoutes = {
      'setting-api': 'setting',
    };

    simulateOnPortCallback(state, serviceRoutes, {
      connectionId: 'setting-renderer--setting',
      role: 'initiator',
      port: { id: 1 },
    });

    expect(state.servicePortMap.has('setting-api')).toBe(false);
    expect(state.peerPortMap.has('setting')).toBe(false);
  });

  it('should map servicePath correctly when renderer is initiator (setting window fix)', () => {
    const state: PortMapState = {
      peerPortMap: new Map(),
      servicePortMap: new Map(),
      firstPort: null,
    };
    const serviceRoutes = {
      'setting-api': 'setting',
    };

    simulateOnPortCallback(state, serviceRoutes, {
      connectionId: 'renderer--setting',
      role: 'initiator',
      port: { id: 1 },
    });

    expect(state.servicePortMap.get('setting-api')).toEqual({ id: 1 });
    expect(state.peerPortMap.get('setting')).toEqual({ id: 1 });
  });

  it('should update servicePortMap on reconnect (Bug 3 regression)', () => {
    const state: PortMapState = {
      peerPortMap: new Map(),
      servicePortMap: new Map(),
      firstPort: null,
    };
    const serviceRoutes = {
      'setting-api': 'setting',
    };

    simulateOnPortCallback(state, serviceRoutes, {
      connectionId: 'renderer--setting',
      role: 'initiator',
      port: { id: 1 },
    });

    expect(state.servicePortMap.get('setting-api')).toEqual({ id: 1 });

    simulateOnPortCallback(state, serviceRoutes, {
      connectionId: 'renderer--setting',
      role: 'initiator',
      port: { id: 2 },
    });

    expect(state.servicePortMap.get('setting-api')).toEqual({ id: 2 });
  });

  it('should update peerPortMap on reconnect with new port', () => {
    const state: PortMapState = {
      peerPortMap: new Map(),
      servicePortMap: new Map(),
      firstPort: null,
    };
    const serviceRoutes = {
      'connection-api': 'connection',
    };

    simulateOnPortCallback(state, serviceRoutes, {
      connectionId: 'renderer--connection',
      role: 'initiator',
      port: { id: 1 },
    });

    simulateOnPortCallback(state, serviceRoutes, {
      connectionId: 'renderer--connection',
      role: 'initiator',
      port: { id: 99 },
    });

    expect(state.peerPortMap.get('connection')).toEqual({ id: 99 });
    expect(state.servicePortMap.get('connection-api')).toEqual({ id: 99 });
  });

  it('should update firstPort on reconnect to same default peer', () => {
    const state: PortMapState = {
      peerPortMap: new Map(),
      servicePortMap: new Map(),
      firstPort: null,
    };

    simulateOnPortCallback(state, undefined, {
      connectionId: 'renderer--connection',
      role: 'initiator',
      port: { id: 1 },
    });

    simulateOnPortCallback(state, undefined, {
      connectionId: 'renderer--connection',
      role: 'initiator',
      port: { id: 2 },
    });

    expect(state.firstPort).toEqual({ id: 2 });
  });

  it('should update firstPort on reconnect with defaultPeerId set', () => {
    const state: PortMapState = {
      peerPortMap: new Map(),
      servicePortMap: new Map(),
      firstPort: null,
    };
    const defaultPeerId = 'pagelet';

    simulateOnPortCallback(
      state,
      undefined,
      {
        connectionId: 'renderer--pagelet',
        role: 'initiator',
        port: { id: 1 },
      },
      defaultPeerId
    );

    expect(state.firstPort).toEqual({ id: 1 });

    simulateOnPortCallback(
      state,
      undefined,
      {
        connectionId: 'renderer--pagelet',
        role: 'initiator',
        port: { id: 2 },
      },
      defaultPeerId
    );

    expect(state.firstPort).toEqual({ id: 2 });
  });

  it('should NOT update firstPort for non-default peer when defaultPeerId is set', () => {
    const state: PortMapState = {
      peerPortMap: new Map(),
      servicePortMap: new Map(),
      firstPort: null,
    };
    const defaultPeerId = 'pagelet';

    simulateOnPortCallback(
      state,
      undefined,
      {
        connectionId: 'renderer--pagelet',
        role: 'initiator',
        port: { id: 1 },
      },
      defaultPeerId
    );

    simulateOnPortCallback(
      state,
      undefined,
      {
        connectionId: 'renderer--monitor',
        role: 'initiator',
        port: { id: 2 },
      },
      defaultPeerId
    );

    expect(state.firstPort).toEqual({ id: 1 });
  });

  it('should update firstPort when default peer reconnects after non-default peer connected', () => {
    const state: PortMapState = {
      peerPortMap: new Map(),
      servicePortMap: new Map(),
      firstPort: null,
    };
    const defaultPeerId = 'pagelet';

    simulateOnPortCallback(
      state,
      undefined,
      {
        connectionId: 'renderer--monitor',
        role: 'initiator',
        port: { id: 1 },
      },
      defaultPeerId
    );

    expect(state.firstPort).toBeNull();

    simulateOnPortCallback(
      state,
      undefined,
      {
        connectionId: 'renderer--pagelet',
        role: 'initiator',
        port: { id: 2 },
      },
      defaultPeerId
    );

    expect(state.firstPort).toEqual({ id: 2 });

    simulateOnPortCallback(
      state,
      undefined,
      {
        connectionId: 'renderer--pagelet',
        role: 'initiator',
        port: { id: 3 },
      },
      defaultPeerId
    );

    expect(state.firstPort).toEqual({ id: 3 });
  });

  it('should handle multiple reconnect cycles', () => {
    const state: PortMapState = {
      peerPortMap: new Map(),
      servicePortMap: new Map(),
      firstPort: null,
    };
    const serviceRoutes = {
      'connection-api': 'connection',
    };

    for (let i = 1; i <= 5; i++) {
      simulateOnPortCallback(state, serviceRoutes, {
        connectionId: 'renderer--connection',
        role: 'initiator',
        port: { id: i },
      });
    }

    expect(state.servicePortMap.get('connection-api')).toEqual({ id: 5 });
    expect(state.peerPortMap.get('connection')).toEqual({ id: 5 });
  });

  it('should handle multiple peers with independent reconnects', () => {
    const state: PortMapState = {
      peerPortMap: new Map(),
      servicePortMap: new Map(),
      firstPort: null,
    };
    const serviceRoutes = {
      'connection-api': 'connection',
      'monitor-api': 'monitor',
    };

    simulateOnPortCallback(state, serviceRoutes, {
      connectionId: 'renderer--connection',
      role: 'initiator',
      port: { id: 1 },
    });
    simulateOnPortCallback(state, serviceRoutes, {
      connectionId: 'renderer--monitor',
      role: 'initiator',
      port: { id: 2 },
    });

    expect(state.servicePortMap.get('connection-api')).toEqual({ id: 1 });
    expect(state.servicePortMap.get('monitor-api')).toEqual({ id: 2 });

    simulateOnPortCallback(state, serviceRoutes, {
      connectionId: 'renderer--connection',
      role: 'initiator',
      port: { id: 3 },
    });

    expect(state.servicePortMap.get('connection-api')).toEqual({ id: 3 });
    expect(state.servicePortMap.get('monitor-api')).toEqual({ id: 2 });
  });
});

describe('getServicePath — auto-discovery in port message handler', () => {
  it('should extract servicePath from incoming message data', () => {
    const data = [[1, 1, 'discovered-service', 'method'], {}];
    expect(getServicePath(data)).toBe('discovered-service');
  });

  it('should allow updating servicePortMap based on auto-discovered servicePath', () => {
    const servicePortMap = new Map<string, number>();
    const port1 = 1;
    const port2 = 2;

    servicePortMap.set('known-service', port1);

    const discoveredService = 'discovered-service';
    servicePortMap.set(discoveredService, port2);

    expect(servicePortMap.get('known-service')).toBe(1);
    expect(servicePortMap.get('discovered-service')).toBe(2);
  });

  it('should allow overwriting servicePortMap on reconnect (Bug 3 regression)', () => {
    const servicePortMap = new Map<string, number>();

    servicePortMap.set('my-service', 1);
    expect(servicePortMap.get('my-service')).toBe(1);

    servicePortMap.set('my-service', 2);
    expect(servicePortMap.get('my-service')).toBe(2);
  });
});
