import { describe, expect, it } from 'vitest';
import {
  ConnectionState,
  isValidTransition,
} from '../../src/orchestrator/ConnectionState';

describe('ConnectionState enum', () => {
  it('should export all six states', () => {
    expect(ConnectionState.IDLE).toBe('IDLE');
    expect(ConnectionState.CONNECTING).toBe('CONNECTING');
    expect(ConnectionState.READY).toBe('READY');
    expect(ConnectionState.TRANSIENT_FAILURE).toBe('TRANSIENT_FAILURE');
    expect(ConnectionState.DISCONNECTING).toBe('DISCONNECTING');
    expect(ConnectionState.CLOSED).toBe('CLOSED');
  });
});

describe('isValidTransition', () => {
  describe('valid transitions', () => {
    const valid: Array<[ConnectionState, ConnectionState]> = [
      [ConnectionState.IDLE, ConnectionState.CONNECTING],
      [ConnectionState.CONNECTING, ConnectionState.IDLE],
      [ConnectionState.CONNECTING, ConnectionState.READY],
      [ConnectionState.READY, ConnectionState.TRANSIENT_FAILURE],
      [ConnectionState.READY, ConnectionState.DISCONNECTING],
      [ConnectionState.TRANSIENT_FAILURE, ConnectionState.CONNECTING],
      [ConnectionState.TRANSIENT_FAILURE, ConnectionState.DISCONNECTING],
      [ConnectionState.DISCONNECTING, ConnectionState.CLOSED],
      [ConnectionState.CLOSED, ConnectionState.CONNECTING],
    ];

    it.each(valid)('%s → %s should be valid', (from, to) => {
      expect(isValidTransition(from, to)).toBe(true);
    });
  });

  describe('invalid transitions', () => {
    const invalid: Array<[ConnectionState, ConnectionState]> = [
      // Cannot self-transition
      [ConnectionState.IDLE, ConnectionState.IDLE],
      [ConnectionState.READY, ConnectionState.READY],
      // Cannot skip states
      [ConnectionState.IDLE, ConnectionState.READY],
      [ConnectionState.IDLE, ConnectionState.TRANSIENT_FAILURE],
      [ConnectionState.IDLE, ConnectionState.CLOSED],
      [ConnectionState.IDLE, ConnectionState.DISCONNECTING],
      [ConnectionState.CONNECTING, ConnectionState.TRANSIENT_FAILURE],
      [ConnectionState.CONNECTING, ConnectionState.DISCONNECTING],
      [ConnectionState.CONNECTING, ConnectionState.CLOSED],
      [ConnectionState.READY, ConnectionState.IDLE],
      [ConnectionState.READY, ConnectionState.CLOSED],
      [ConnectionState.TRANSIENT_FAILURE, ConnectionState.IDLE],
      [ConnectionState.TRANSIENT_FAILURE, ConnectionState.READY],
      [ConnectionState.TRANSIENT_FAILURE, ConnectionState.CLOSED],
      [ConnectionState.DISCONNECTING, ConnectionState.IDLE],
      [ConnectionState.DISCONNECTING, ConnectionState.CONNECTING],
      [ConnectionState.DISCONNECTING, ConnectionState.READY],
      [ConnectionState.DISCONNECTING, ConnectionState.TRANSIENT_FAILURE],
      // CLOSED cannot go back to IDLE or other non-CONNECTING states
      [ConnectionState.CLOSED, ConnectionState.IDLE],
      [ConnectionState.CLOSED, ConnectionState.READY],
      [ConnectionState.CLOSED, ConnectionState.TRANSIENT_FAILURE],
      [ConnectionState.CLOSED, ConnectionState.DISCONNECTING],
      [ConnectionState.CLOSED, ConnectionState.CLOSED],
    ];

    it.each(invalid)('%s → %s should be invalid', (from, to) => {
      expect(isValidTransition(from, to)).toBe(false);
    });
  });
});
