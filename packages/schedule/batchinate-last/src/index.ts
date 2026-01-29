import debounce from '@x-oasis/debounce';

/**
 * BatchinateLast - Executes the callback with the last arguments after a delay.
 * If schedule is called multiple times within the delay period, only the last
 * call's arguments will be used when the callback executes.
 */
type TaskHandler = {
  cancel: () => void;
};

class BatchinateLast {
  readonly _delayMS: number;
  private _callback: (...args: any[]) => void;
  private _debounced: ReturnType<typeof debounce>;
  private _storedArgs: any[] | null = null;
  private _isScheduled = false;
  private _clockTime = 0;
  private _lastTime = 0;
  private _rescheduleHandler: TaskHandler | null = null;

  constructor(cb: (...args: any[]) => void, delayMS: number) {
    this._callback = cb;
    this._delayMS = delayMS;

    // Helper function to handle execution and potential rescheduling
    const executeAndReschedule = (): void => {
      const savedClockTime = this._clockTime;
      this._isScheduled = false;
      if (this._rescheduleHandler) {
        this._rescheduleHandler.cancel();
        this._rescheduleHandler = null;
      }

      if (this._storedArgs !== null) {
        this._callback(...this._storedArgs);
      }

      // Check if there were new calls during execution
      // If lastTime was updated (clockTime !== lastTime), reschedule
      if (this._delayMS && savedClockTime !== this._lastTime) {
        const now = Date.now();
        const elapsedTime = now - this._lastTime;
        const timeoutTime = Math.max(this._delayMS - elapsedTime, 0);
        this._clockTime = now;

        // Reschedule with remaining time
        const timeoutHandle = setTimeout(() => {
          executeAndReschedule();
        }, timeoutTime);
        this._rescheduleHandler = { cancel: () => clearTimeout(timeoutHandle) };
        this._isScheduled = true;
      }
    };

    // Create a debounced function
    // Special behavior: if new calls occur during execution, reschedule
    this._debounced = debounce(executeAndReschedule, delayMS, {
      leading: false,
      trailing: true,
    });
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
      if (this._rescheduleHandler) {
        this._rescheduleHandler.cancel();
        this._rescheduleHandler = null;
      }
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
    return this._isScheduled || this._rescheduleHandler !== null;
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
    if (this._rescheduleHandler) {
      this._rescheduleHandler.cancel();
      this._rescheduleHandler = null;
    }
    this._isScheduled = false;
  }

  /**
   * Schedule the callback to execute after delayMS
   * If called multiple times, only the last call's arguments will be used
   * @param args - Arguments to pass to the callback
   */
  schedule(...args: any[]): void {
    this._storedArgs = args;
    const now = Date.now();
    this._lastTime = now;

    // Handle zero delay case - execute immediately
    if (!this._delayMS) {
      if (this._storedArgs !== null) {
        this._callback(...this._storedArgs);
      }
      return;
    }

    // If already scheduled, just update args and return (don't reset timer)
    if (this._isScheduled) {
      return;
    }

    // First call - mark as scheduled and call debounce
    this._isScheduled = true;
    this._clockTime = now;
    this._debounced();
  }
}

export default BatchinateLast;
