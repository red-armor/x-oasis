// Helper function
const defaultBooleanValue = (value: boolean | undefined, defaultValue: boolean): boolean => {
  return value !== undefined ? value : defaultValue;
};

// https://github.com/facebook/react-native/blob/main/Libraries/Interaction/Batchinator.js

type TaskHandle = {
  cancel: () => void;
};

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
  private _args: any[] | null;
  private _callback: (...args: any[]) => void;
  private _taskHandle: TaskHandle | null;
  private _leading: boolean;
  private _trailing: boolean;

  constructor(
    cb: (...args: any[]) => void,
    delayMS: number,
    options?: BatchinatorOptions
  ) {
    this._callback = cb;
    this._delayMS = delayMS;
    this._taskHandle = null;
    this._args = null;
    this._leading = defaultBooleanValue(options?.leading, false);
    this._trailing = defaultBooleanValue(options?.trailing, true);
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
    if (this._taskHandle) {
      this._taskHandle.cancel();
      this._taskHandle = null;
    }
    if (
      typeof this._callback === 'function' &&
      !abort &&
      this._args !== null
    ) {
      this._callback.apply(this, this._args);
    }
  }

  /**
   * Check if a task is currently scheduled
   */
  inSchedule(): boolean {
    return this._taskHandle !== null;
  }

  /**
   * Flush the scheduled task immediately
   * @param args - Optional arguments to use instead of stored args
   */
  flush(...args: any[]): void {
    if (args.length > 0) {
      this._args = args;
    }
    if (this._taskHandle) {
      this._taskHandle.cancel();
      this._taskHandle = null;
    }
    if (this._args !== null) {
      this._callback.apply(this, this._args);
    }
  }

  /**
   * Schedule the callback execution
   * @param args - Arguments to pass to the callback
   */
  schedule(...args: any[]): void {
    this._args = args;

    // If already scheduled, just update args and return
    if (this._taskHandle) {
      return;
    }

    // Handler for timeout completion
    const handler = (): void => {
      this._taskHandle = null;
      if (this._trailing && this._args !== null) {
        this._callback.apply(this, this._args);
      }
    };

    // If no delay, execute immediately based on leading/trailing
    if (!this._delayMS) {
      if (this._leading) {
        this._callback.apply(this, this._args);
      } else if (this._trailing) {
        handler();
      }
      return;
    }

    // Execute immediately if leading is enabled
    if (this._leading) {
      this._callback.apply(this, this._args);
    }

    // Schedule trailing execution
    const timeoutHandle = setTimeout(() => {
      handler();
    }, this._delayMS);

    this._taskHandle = { cancel: () => clearTimeout(timeoutHandle) };
  }
}

export default Batchinator;
