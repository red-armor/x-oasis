import { describe, expect, test, vi, beforeEach } from 'vitest';
import { Emitter, Event, fromNodeEvent } from '../src';
import { EventEmitter } from 'events';

describe('Event', () => {
  let event: Event;

  beforeEach(() => {
    event = new Event({ name: 'test' });
  });

  describe('subscribe', () => {
    test('should subscribe to an event', () => {
      const listener = vi.fn();
      const disposable = event.subscribe(listener);

      expect(listener).not.toHaveBeenCalled();

      event.fire('test data');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith('test data');

      disposable.dispose();
    });

    test('should return a disposable', () => {
      const listener = vi.fn();
      const disposable = event.subscribe(listener);

      expect(disposable).toBeDefined();
      expect(typeof disposable.dispose).toBe('function');

      disposable.dispose();
      event.fire('test');
      expect(listener).not.toHaveBeenCalled();
    });

    test('should support multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      event.subscribe(listener1);
      event.subscribe(listener2);
      event.subscribe(listener3);

      event.fire('data');

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
      expect(listener1).toHaveBeenCalledWith('data');
      expect(listener2).toHaveBeenCalledWith('data');
      expect(listener3).toHaveBeenCalledWith('data');
    });

    test('should pass multiple arguments', () => {
      const listener = vi.fn();
      event.subscribe(listener);

      event.fire('arg1', 'arg2', 'arg3');

      expect(listener).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });

    test('should warn on duplicate listener', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const listener = vi.fn();

      event.subscribe(listener);
      event.subscribe(listener); // Duplicate

      expect(consoleSpy).toHaveBeenCalledWith('add a duplicate listener');

      consoleSpy.mockRestore();
    });
  });

  describe('removeListener', () => {
    test('should remove a listener', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      event.subscribe(listener1);
      event.subscribe(listener2);

      event.removeListener(listener1);

      event.fire('test');
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    test('should do nothing if listener not found', () => {
      const listener = vi.fn();
      event.removeListener(listener); // Should not throw
      expect(() => event.fire('test')).not.toThrow();
    });
  });

  describe('fire', () => {
    test('should call all listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      event.subscribe(listener1);
      event.subscribe(listener2);
      event.subscribe(listener3);

      event.fire('data');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
      expect(listener3).toHaveBeenCalled();
    });

    test('should propagate errors from listeners', () => {
      const error = new Error('Test error');
      const listener1 = vi.fn();
      const listener2 = vi.fn(() => {
        throw error;
      });
      const listener3 = vi.fn();

      event.subscribe(listener1);
      event.subscribe(listener2);
      event.subscribe(listener3);

      // Errors are propagated, so listener3 may not be called
      expect(() => event.fire('data')).toThrow('Test error');
      expect(listener1).toHaveBeenCalled();
      // listener3 may not be called if error is thrown before it
    });
  });

  describe('dispose', () => {
    test('should remove all listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      event.subscribe(listener1);
      event.subscribe(listener2);

      event.dispose();

      event.fire('test');
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    test('should call onDidRemoveLastListener on dispose', () => {
      const onDidRemoveLastListener = vi.fn();
      const eventWithHook = new Event({
        name: 'test',
        onDidRemoveLastListener,
      });

      const listener = vi.fn();
      eventWithHook.subscribe(listener);
      eventWithHook.dispose();

      expect(onDidRemoveLastListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('lifecycle hooks', () => {
    test('should call onWillAddFirstListener', () => {
      const onWillAddFirstListener = vi.fn();
      const eventWithHook = new Event({
        name: 'test',
        onWillAddFirstListener,
      });

      eventWithHook.subscribe(vi.fn());
      expect(onWillAddFirstListener).toHaveBeenCalledTimes(1);
    });

    test('should call onDidAddFirstListener', () => {
      const onDidAddFirstListener = vi.fn();
      const eventWithHook = new Event({
        name: 'test',
        onDidAddFirstListener,
      });

      eventWithHook.subscribe(vi.fn());
      expect(onDidAddFirstListener).toHaveBeenCalledTimes(1);
    });

    test('should call onDidAddListener for each subscription', () => {
      const onDidAddListener = vi.fn();
      const eventWithHook = new Event({
        name: 'test',
        onDidAddListener,
      });

      eventWithHook.subscribe(vi.fn());
      eventWithHook.subscribe(vi.fn());
      eventWithHook.subscribe(vi.fn());

      expect(onDidAddListener).toHaveBeenCalledTimes(3);
    });

    test('should call onWillRemoveListener', () => {
      const onWillRemoveListener = vi.fn();
      const eventWithHook = new Event({
        name: 'test',
        onWillRemoveListener,
      });

      const listener = vi.fn();
      eventWithHook.subscribe(listener);
      eventWithHook.removeListener(listener);

      expect(onWillRemoveListener).toHaveBeenCalledTimes(1);
    });

    test('should call onDidRemoveLastListener when last listener removed', () => {
      const onDidRemoveLastListener = vi.fn();
      const eventWithHook = new Event({
        name: 'test',
        onDidRemoveLastListener,
      });

      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventWithHook.subscribe(listener1);
      eventWithHook.subscribe(listener2);

      eventWithHook.removeListener(listener1);
      expect(onDidRemoveLastListener).not.toHaveBeenCalled();

      eventWithHook.removeListener(listener2);
      expect(onDidRemoveLastListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('coldTrigger', () => {
    test('should trigger new listeners with last value', () => {
      const eventWithColdTrigger = new Event({
        name: 'test',
        coldTrigger: true,
      });

      eventWithColdTrigger.fire('initial value');

      const listener = vi.fn();
      eventWithColdTrigger.subscribe(listener);

      // Should receive the last fired value immediately
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith('initial value');
    });

    test('should update cached value on fire', () => {
      const eventWithColdTrigger = new Event({
        name: 'test',
        coldTrigger: true,
      });

      eventWithColdTrigger.fire('value 1');
      eventWithColdTrigger.fire('value 2');

      const listener = vi.fn();
      eventWithColdTrigger.subscribe(listener);

      // Should receive the most recent value
      expect(listener).toHaveBeenCalledWith('value 2');
    });

    test('should not cache when coldTrigger is false', () => {
      const normalEvent = new Event({
        name: 'test',
        coldTrigger: false,
      });

      normalEvent.fire('value');

      const listener = vi.fn();
      normalEvent.subscribe(listener);

      // Should not receive the value
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('name', () => {
    test('should have the correct name', () => {
      const event = new Event({ name: 'myEvent' });
      expect(event.name).toBe('myEvent');
    });
  });
});

describe('Emitter', () => {
  let emitter: Emitter;

  beforeEach(() => {
    emitter = new Emitter({ name: 'testEmitter' });
  });

  describe('constructor', () => {
    test('should create an emitter with a name', () => {
      const emitter = new Emitter({ name: 'myEmitter' });
      expect(emitter.name).toBe('myEmitter');
    });
  });

  describe('register', () => {
    test('should register a new event', () => {
      const event = emitter.register('click');
      expect(event).toBeInstanceOf(Event);
      expect(event.name).toBe('click');
    });

    test('should return existing event if already registered', () => {
      const event1 = emitter.register('click');
      const event2 = emitter.register('click');

      expect(event1).toBe(event2);
    });

    test('should accept event props', () => {
      const onWillAddFirstListener = vi.fn();
      const event = emitter.register('test', {
        onWillAddFirstListener,
      });

      event.subscribe(vi.fn());
      expect(onWillAddFirstListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('getEvent', () => {
    test('should return registered event', () => {
      const registeredEvent = emitter.register('click');
      const retrievedEvent = emitter.getEvent('click');

      expect(retrievedEvent).toBe(registeredEvent);
    });

    test('should return undefined for unregistered event', () => {
      const event = emitter.getEvent('nonexistent');
      expect(event).toBeUndefined();
    });
  });

  describe('dispose', () => {
    test('should dispose all events', () => {
      const event1 = emitter.register('event1');
      const event2 = emitter.register('event2');

      const listener1 = vi.fn();
      const listener2 = vi.fn();

      event1.subscribe(listener1);
      event2.subscribe(listener2);

      emitter.dispose();

      event1.fire('test');
      event2.fire('test');

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    test('should not dispose twice', () => {
      const event = emitter.register('test');
      const listener = vi.fn();

      event.subscribe(listener);

      emitter.dispose();
      emitter.dispose(); // Should not throw

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('multiple events', () => {
    test('should manage multiple events independently', () => {
      const clickEvent = emitter.register('click');
      const hoverEvent = emitter.register('hover');
      const keydownEvent = emitter.register('keydown');

      const clickListener = vi.fn();
      const hoverListener = vi.fn();
      const keydownListener = vi.fn();

      clickEvent.subscribe(clickListener);
      hoverEvent.subscribe(hoverListener);
      keydownEvent.subscribe(keydownListener);

      clickEvent.fire('click data');
      hoverEvent.fire('hover data');
      keydownEvent.fire('keydown data');

      expect(clickListener).toHaveBeenCalledWith('click data');
      expect(hoverListener).toHaveBeenCalledWith('hover data');
      expect(keydownListener).toHaveBeenCalledWith('keydown data');
    });
  });
});

describe('fromNodeEvent', () => {
  test('should create a subscription function from Node.js event emitter', () => {
    const nodeEmitter = new EventEmitter();
    const subscribe = fromNodeEvent(nodeEmitter, 'data');

    const listener = vi.fn();
    const disposable = subscribe(listener);

    nodeEmitter.emit('data', 'test data');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('test data');

    disposable.dispose();
  });

  test('should unsubscribe when disposed', () => {
    const nodeEmitter = new EventEmitter();
    const subscribe = fromNodeEvent(nodeEmitter, 'data');

    const listener = vi.fn();
    const disposable = subscribe(listener);

    disposable.dispose();

    nodeEmitter.emit('data', 'test');
    expect(listener).not.toHaveBeenCalled();
  });

  test('should handle multiple arguments', () => {
    const nodeEmitter = new EventEmitter();
    const subscribe = fromNodeEvent(nodeEmitter, 'data');

    const listener = vi.fn();
    subscribe(listener);

    nodeEmitter.emit('data', 'arg1', 'arg2', 'arg3');

    expect(listener).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
  });

  test('should only add listener when first subscription', () => {
    const nodeEmitter = new EventEmitter();
    const addListenerSpy = vi.spyOn(nodeEmitter, 'on');
    const subscribe = fromNodeEvent(nodeEmitter, 'data');

    const listener1 = vi.fn();
    const listener2 = vi.fn();

    subscribe(listener1);
    expect(addListenerSpy).toHaveBeenCalledTimes(1);

    subscribe(listener2);
    expect(addListenerSpy).toHaveBeenCalledTimes(1); // Should not add again
  });

  test('should remove listener when last subscription disposed', () => {
    const nodeEmitter = new EventEmitter();
    const removeListenerSpy = vi.spyOn(nodeEmitter, 'removeListener');
    const subscribe = fromNodeEvent(nodeEmitter, 'data');

    const listener1 = vi.fn();
    const listener2 = vi.fn();

    const disposable1 = subscribe(listener1);
    const disposable2 = subscribe(listener2);

    disposable1.dispose();
    expect(removeListenerSpy).not.toHaveBeenCalled(); // Still has listener2

    disposable2.dispose();
    expect(removeListenerSpy).toHaveBeenCalledTimes(1); // Last one removed
  });
});

describe('Integration tests', () => {
  test('should work with Emitter and Event together', () => {
    const emitter = new Emitter({ name: 'app' });

    const clickEvent = emitter.register('click');
    const listener = vi.fn();

    clickEvent.subscribe(listener);
    clickEvent.fire('clicked');

    expect(listener).toHaveBeenCalledWith('clicked');

    emitter.dispose();
  });

  test('should handle complex event flow', () => {
    const emitter = new Emitter({ name: 'complex' });

    const event1 = emitter.register('event1');
    const event2 = emitter.register('event2', {
      coldTrigger: true,
    });

    const results: any[] = [];

    event1.subscribe((data) => {
      results.push(`event1: ${data}`);
    });

    event2.fire('initial');
    event2.subscribe((data) => {
      results.push(`event2: ${data}`);
    });

    event1.fire('data1');
    event2.fire('updated');

    expect(results).toEqual([
      'event2: initial', // Cold trigger
      'event1: data1',
      'event2: updated',
    ]);

    emitter.dispose();
  });
});
