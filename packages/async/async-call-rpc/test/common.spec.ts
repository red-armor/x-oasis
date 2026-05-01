import { expect, describe, test } from 'vitest';
import {
  isEventMethod,
  isAssignPassingPortMethod,
  isAcquirePortMethod,
  isOptionsMethod,
} from '../src/common';

/**
 * Test suite for common utility functions
 * Covers: method name detection functions
 */
describe('Common Utilities', () => {
  describe('isEventMethod', () => {
    test('should recognize onXxx event methods', () => {
      expect(isEventMethod('onPing')).toBe(true);
      expect(isEventMethod('onData')).toBe(true);
      expect(isEventMethod('onEvent')).toBe(true);
      expect(isEventMethod('onCustomEvent')).toBe(true);
    });

    test('should reject non-event methods', () => {
      expect(isEventMethod('ping')).toBe(false);
      expect(isEventMethod('data')).toBe(false);
      expect(isEventMethod('method')).toBe(false);
    });

    test('should reject methods starting with lowercase after on', () => {
      expect(isEventMethod('onping')).toBe(false);
      expect(isEventMethod('onData')).toBe(true); // D is uppercase
    });

    test('should reject single letter or shorter names', () => {
      expect(isEventMethod('on')).toBe(false);
      expect(isEventMethod('o')).toBe(false);
      expect(isEventMethod('')).toBe(false);
    });

    test('should handle non-string inputs', () => {
      expect(isEventMethod(null as any)).toBe(false);
      expect(isEventMethod(undefined as any)).toBe(false);
      expect(isEventMethod(123 as any)).toBe(false);
      expect(isEventMethod({} as any)).toBe(false);
    });

    test('should recognize various event method patterns', () => {
      expect(isEventMethod('onComplete')).toBe(true);
      expect(isEventMethod('onError')).toBe(true);
      expect(isEventMethod('onSuccess')).toBe(true);
      expect(isEventMethod('onCountdown')).toBe(true);
      expect(isEventMethod('onHeartbeat')).toBe(true);
    });
  });

  describe('isAssignPassingPortMethod', () => {
    test('should recognize assignPassingPort method', () => {
      expect(isAssignPassingPortMethod('assignPassingPort')).toBe(true);
    });

    test('should reject similar but different names', () => {
      expect(isAssignPassingPortMethod('assignPassingPorts')).toBe(false);
      expect(isAssignPassingPortMethod('AssignPassingPort')).toBe(false);
      expect(isAssignPassingPortMethod('assign_passing_port')).toBe(false);
      expect(isAssignPassingPortMethod('port')).toBe(false);
    });

    test('should handle non-string inputs', () => {
      expect(isAssignPassingPortMethod(null as any)).toBe(false);
      expect(isAssignPassingPortMethod(undefined as any)).toBe(false);
    });
  });

  describe('isAcquirePortMethod', () => {
    test('should recognize acquire*Port method patterns', () => {
      expect(isAcquirePortMethod('acquirePort')).toBe(true);
      expect(isAcquirePortMethod('acquireLongLivedPort')).toBe(true);
      expect(isAcquirePortMethod('acquireTemporaryPort')).toBe(true);
      expect(isAcquirePortMethod('acquireWorkerPort')).toBe(true);
    });

    test('should reject non-matching patterns', () => {
      expect(isAcquirePortMethod('port')).toBe(false);
      expect(isAcquirePortMethod('acquireData')).toBe(false);
      expect(isAcquirePortMethod('releasePort')).toBe(false);
      expect(isAcquirePortMethod('AcquirePort')).toBe(false);
    });

    test('should handle edge cases', () => {
      expect(isAcquirePortMethod('acquire')).toBe(false);
      expect(isAcquirePortMethod('Port')).toBe(false);
    });
  });

  describe('isOptionsMethod', () => {
    test('should recognize methods ending with Options', () => {
      expect(isOptionsMethod('getOptions')).toBe(true);
      expect(isOptionsMethod('setOptions')).toBe(true);
      expect(isOptionsMethod('configOptions')).toBe(true);
    });

    test('should recognize methods ending with OptionsRequest', () => {
      expect(isOptionsMethod('getOptionsRequest')).toBe(true);
      expect(isOptionsMethod('initializeOptionsRequest')).toBe(true);
    });

    test('should reject non-matching patterns', () => {
      expect(isOptionsMethod('getOption')).toBe(false);
      expect(isOptionsMethod('config')).toBe(false);
      expect(isOptionsMethod('method')).toBe(false);
      expect(isOptionsMethod('OptionsGetter')).toBe(false);
    });

    test('should handle edge cases', () => {
      expect(isOptionsMethod('Options')).toBe(true); // Just "Options"
      expect(isOptionsMethod('OptionsRequest')).toBe(true);
    });

    test('should be case sensitive', () => {
      expect(isOptionsMethod('getoptions')).toBe(false);
      expect(isOptionsMethod('getOPTIONS')).toBe(false);
    });
  });
});
