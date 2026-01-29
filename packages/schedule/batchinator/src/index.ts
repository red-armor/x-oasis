import debounce from '@x-oasis/debounce';
import defaultBooleanValue from '@x-oasis/default-boolean-value';

// https://github.com/facebook/react-native/blob/main/Libraries/Interaction/Batchinator.js

type BatchinatorOptions = {
  leading?: boolean;
  trailing?: boolean;
};

/**
 * Batchinator - Batches callback executions with configurable leading/trailing behavior.
 * Similar to debounce/throttle but with more control over execution timing.
 */
class Batchinator {
  readonly _delayMS: number;
  private _callback: (...args: any[]) => void;
  private _debounced: ReturnType<typeof debounce>;
  private _leading: boolean;
  private _trailing: boolean;
  private _isScheduled = false;
  private _storedArgs: any[] | null = null;

  constructor(
    cb: (...args: any[]) => void,
    delayMS: number,
    options?: BatchinatorOptions
  ) {
    this._callback = cb;
    this._delayMS = delayMS;
    this._leading = defaultBooleanValue(options?.leading, false);
    this._trailing = defaultBooleanValue(options?.trailing, true);

    // Create a debounced function that wraps our callback
    // The key difference from debounce: if already scheduled, schedule() only updates args
    // We handle this by tracking _isScheduled and only calling debounce on first schedule
    this._debounced = debounce(
      () => {
        this._isScheduled = false;
        if (this._storedArgs !== null) {
          this._callback(...this._storedArgs);
        }
      },
      delayMS,
      {
        leading: this._leading,
        trailing: this._trailing,
      }
    );
  }

  /**
   * Dispose the scheduled task
   * @param options - Configuration options
   * @param options.abort - If true, cancel without executing callback
   */
  dispose(
    options: {
      abort?: boolean;
    } = {
      abort: false,
    }
  ): void {
    const { abort = false } = options;
    if (abort) {
      this._debounced.cancel();
      this._isScheduled = false;
      this._storedArgs = null;
    } else {
      // Execute with current args if any
      if (this._storedArgs !== null) {
        this._debounced.flush();
      }
    }
  }

  /**
   * Check if a task is currently scheduled
   */
  inSchedule(): boolean {
    return this._isScheduled;
  }

  /**
   * Flush the scheduled task immediately
   * @param args - Optional arguments to use instead of stored args
   */
  flush(...args: any[]): void {
    if (args.length > 0) {
      this._storedArgs = args;
    }
    this._debounced.flush();
    this._isScheduled = false;
  }

  /**
   * Schedule the callback execution
   * @param args - Arguments to pass to the callback
   */
  schedule(...args: any[]): void {
    this._storedArgs = args;

    // If already scheduled, just update args and return (don't reset timer)
    // This is the key difference from debounce
    if (this._isScheduled) {
      return;
    }

    // Handle zero delay case - execute immediately based on leading/trailing
    if (!this._delayMS) {
      if (this._leading) {
        this._callback(...this._storedArgs);
      } else if (this._trailing) {
        // For zero delay with trailing, execute immediately
        this._callback(...this._storedArgs);
      }
      return;
    }

    // First call - mark as scheduled and call debounce
    this._isScheduled = true;
    this._debounced();
  }
}

export default Batchinator;
