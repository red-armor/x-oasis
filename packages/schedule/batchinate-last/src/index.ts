type TaskHandler = {
  cancel: () => void;
};

/**
 * BatchinateLast - Executes the callback with the last arguments after a delay.
 * If schedule is called multiple times within the delay period, only the last
 * call's arguments will be used when the callback executes.
 */
class BatchinateLast {
  readonly _delayMS: number;
  private _args: any[] | null;
  private _callback: (...args: any[]) => void;
  private _clockTime: number;
  private _lastTime: number;
  private _taskHandler: TaskHandler | null;

  constructor(cb: (...args: any[]) => void, delayMS: number) {
    this._callback = cb;
    this._delayMS = delayMS;
    this._taskHandler = null;
    this._args = null;
    this._clockTime = 0;
    this._lastTime = 0;
    this.handler = this.handler.bind(this);
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
    if (this._taskHandler) {
      this._taskHandler.cancel();
      this._taskHandler = null;
    }
    if (typeof this._callback === 'function' && !abort && this._args !== null) {
      this._callback.apply(this, this._args);
    }
  }

  /**
   * Check if a task is currently scheduled
   */
  inSchedule(): boolean {
    return this._taskHandler !== null;
  }

  /**
   * Flush the scheduled task immediately
   * @param args - Optional arguments to use instead of stored args
   */
  flush(...args: any[]): void {
    if (args.length > 0) {
      this._args = args;
    }
    if (this._taskHandler) {
      this._taskHandler.cancel();
      this._taskHandler = null;
    }
    if (this._args !== null) {
      this._callback.apply(this, this._args);
    }
  }

  private handler(): void {
    if (this._taskHandler) {
      this._taskHandler.cancel();
      this._taskHandler = null;
    }

    if (this._args !== null) {
      this._callback.apply(this, this._args);
    }

    // If there were new calls during execution, schedule another execution
    if (this._delayMS && this._clockTime !== this._lastTime) {
      const elapsedTime = Date.now() - this._lastTime;
      const timeoutTime = Math.max(this._delayMS - elapsedTime, 0);
      this._clockTime = Date.now();
      const timeoutHandler = setTimeout(() => {
        this.handler();
      }, timeoutTime);

      this._taskHandler = { cancel: () => clearTimeout(timeoutHandler) };
    }
  }

  /**
   * Schedule the callback to execute after delayMS
   * If called multiple times, only the last call's arguments will be used
   * @param args - Arguments to pass to the callback
   */
  schedule(...args: any[]): void {
    this._args = args;
    const now = Date.now();
    this._lastTime = now;

    // If already scheduled, just update args and return
    if (this._taskHandler) {
      return;
    }

    // If no delay, execute immediately
    if (!this._delayMS) {
      this.handler();
      return;
    }

    // Schedule execution
    this._clockTime = now;
    const timeoutHandler = setTimeout(() => {
      this.handler();
    }, this._delayMS);

    this._taskHandler = { cancel: () => clearTimeout(timeoutHandler) };
  }
}

export default BatchinateLast;
