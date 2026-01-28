# @x-oasis/batchinate-last

Executes the callback with the last arguments after a delay. If `schedule` is called multiple times within the delay period, only the last call's arguments will be used when the callback executes.

This is useful for scenarios where you want to batch multiple rapid calls and only process the final state.

## Installation

```bash
npm install @x-oasis/batchinate-last
# or
pnpm add @x-oasis/batchinate-last
# or
yarn add @x-oasis/batchinate-last
```

## Usage

### Basic Usage

```typescript
import BatchinateLast from '@x-oasis/batchinate-last';

const callback = (message: string) => {
  console.log(message);
};

const batchinator = new BatchinateLast(callback, 100);

// Schedule multiple calls
batchinator.schedule('First');
batchinator.schedule('Second');
batchinator.schedule('Third');

// Only 'Third' will execute after 100ms
```

### Flush Scheduled Task

Immediately execute the scheduled task:

```typescript
import BatchinateLast from '@x-oasis/batchinate-last';

const batchinator = new BatchinateLast(callback, 100);

batchinator.schedule('First');
batchinator.schedule('Second');
batchinator.flush();  // Executes immediately with 'Second'

// Or flush with new arguments
batchinator.flush('Custom');
```

### Dispose

Cancel the scheduled task and optionally execute it:

```typescript
import BatchinateLast from '@x-oasis/batchinate-last';

const batchinator = new BatchinateLast(callback, 100);

batchinator.schedule('First');
batchinator.schedule('Second');

// Dispose and execute
batchinator.dispose();  // Executes with 'Second'

// Dispose without executing
batchinator.dispose({ abort: true });  // Cancels without executing
```

### Check Schedule Status

Check if a task is currently scheduled:

```typescript
import BatchinateLast from '@x-oasis/batchinate-last';

const batchinator = new BatchinateLast(callback, 100);

batchinator.schedule('First');
console.log(batchinator.inSchedule());  // true

// After execution or cancel
batchinator.flush();
console.log(batchinator.inSchedule());  // false
```

### Continuous Scheduling

If new calls are made during execution, the handler will automatically reschedule:

```typescript
import BatchinateLast from '@x-oasis/batchinate-last';

const batchinator = new BatchinateLast(callback, 100);

batchinator.schedule('First');
// ... 50ms later
batchinator.schedule('Second');
// ... 50ms later (during execution)
batchinator.schedule('Third');
// Handler will reschedule to execute 'Third'
```

## API

### `new BatchinateLast(callback, delayMS)`

Creates a new BatchinateLast instance.

#### Parameters

- `callback` (`Function`): The function to execute with the last arguments.
- `delayMS` (`number`): The delay in milliseconds before executing the callback.

#### Returns

Returns a new `BatchinateLast` instance.

### Instance Methods

#### `schedule(...args)`

Schedule the callback to execute after `delayMS`. If called multiple times, only the last call's arguments will be used.

- `args` (`...any[]`): Arguments to pass to the callback.

#### `flush(...args)`

Immediately execute the scheduled task. If arguments are provided, they will be used instead of stored arguments.

- `args` (`...any[]`, optional): Optional arguments to use instead of stored args.

#### `dispose(options?)`

Dispose the scheduled task. By default, executes the callback with stored arguments unless `abort` is `true`.

- `options` (`Object`, optional): Configuration options.
  - `abort` (`boolean`, default: `false`): If `true`, cancel without executing callback.

#### `inSchedule()`

Check if a task is currently scheduled.

- Returns: `boolean` - `true` if a task is scheduled, `false` otherwise.

## Examples

### Search Input

```typescript
import BatchinateLast from '@x-oasis/batchinate-last';

const performSearch = (query: string) => {
  // Perform search with query
  console.log('Searching for:', query);
};

const batchinator = new BatchinateLast(performSearch, 300);

// User types in search box
input.addEventListener('input', (e) => {
  batchinator.schedule(e.target.value);
});

// Only the final query executes after user stops typing
```

### Window Resize Handler

```typescript
import BatchinateLast from '@x-oasis/batchinate-last';

const handleResize = (width: number, height: number) => {
  // Recalculate layout
  console.log('Resized to:', width, height);
};

const batchinator = new BatchinateLast(handleResize, 200);

window.addEventListener('resize', () => {
  batchinator.schedule(window.innerWidth, window.innerHeight);
});

// Only the final dimensions are processed
```

### Form Auto-save

```typescript
import BatchinateLast from '@x-oasis/batchinate-last';

const saveForm = (formData: any) => {
  // Save form data
  console.log('Saving form:', formData);
};

const batchinator = new BatchinateLast(saveForm, 1000);

form.addEventListener('input', () => {
  const formData = new FormData(form);
  batchinator.schedule(Object.fromEntries(formData));
});

// Form saves 1 second after user stops editing
```

### Scroll Position Tracking

```typescript
import BatchinateLast from '@x-oasis/batchinate-last';

const updateScrollPosition = (x: number, y: number) => {
  // Update scroll position in state
  console.log('Scroll position:', x, y);
};

const batchinator = new BatchinateLast(updateScrollPosition, 100);

window.addEventListener('scroll', () => {
  batchinator.schedule(window.scrollX, window.scrollY);
});

// Only the final scroll position is tracked
```

### Cleanup on Component Unmount

```typescript
import BatchinateLast from '@x-oasis/batchinate-last';
import { useEffect } from 'react';

function MyComponent() {
  const batchinator = new BatchinateLast(handleUpdate, 100);

  useEffect(() => {
    // Use batchinator
    batchinator.schedule(data);

    // Cleanup on unmount
    return () => {
      batchinator.dispose({ abort: true });
    };
  }, []);
}
```

## Differences from Other Utilities

### vs Debounce

- **BatchinateLast**: Always uses the last arguments, executes after a fixed delay.
- **Debounce**: Resets the delay timer on each call, executes only after a period of inactivity.

### vs Throttle

- **BatchinateLast**: Executes once with the last arguments after the delay.
- **Throttle**: Executes at most once per period, regardless of call frequency.

### vs Batchinator

- **BatchinateLast**: Simpler, always executes with last arguments after delay.
- **Batchinator**: More configurable, supports leading/trailing execution options.

## When to Use BatchinateLast

- Search input debouncing
- Window resize handlers
- Form auto-save
- Scroll position tracking
- Any scenario where you want to batch rapid calls and only process the final state

## See Also

- [@x-oasis/batchinator](../batchinator/README.md) - Batches with leading/trailing options
- [@x-oasis/debounce](../debounce/README.md) - Creates a debounced function
- [@x-oasis/throttle](../throttle/README.md) - Creates a throttled function

## License

ISC
