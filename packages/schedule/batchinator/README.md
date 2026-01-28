# @x-oasis/batchinator

Batches callback executions with configurable leading/trailing behavior. Similar to debounce/throttle but with more control over execution timing.

Inspired by [React Native's Batchinator](https://github.com/facebook/react-native/blob/main/Libraries/Interaction/Batchinator.js).

## Installation

```bash
npm install @x-oasis/batchinator
# or
pnpm add @x-oasis/batchinator
# or
yarn add @x-oasis/batchinator
```

## Usage

### Basic Usage

```typescript
import Batchinator from '@x-oasis/batchinator';

const callback = (message: string) => {
  console.log(message);
};

const batchinator = new Batchinator(callback, 100);

// Schedule multiple calls
batchinator.schedule('First');
batchinator.schedule('Second');
batchinator.schedule('Third');

// Only the last call ('Third') will execute after 100ms
```

### With Leading Option

Execute immediately on the first call, then batch subsequent calls:

```typescript
import Batchinator from '@x-oasis/batchinator';

const batchinator = new Batchinator(callback, 100, {
  leading: true,
  trailing: true
});

batchinator.schedule('First');  // Executes immediately
batchinator.schedule('Second');  // Batched
batchinator.schedule('Third');  // Batched
// After 100ms, 'Third' executes (trailing)
```

### With Trailing: false

Only execute on the leading edge:

```typescript
import Batchinator from '@x-oasis/batchinator';

const batchinator = new Batchinator(callback, 100, {
  leading: true,
  trailing: false
});

batchinator.schedule('First');  // Executes immediately
batchinator.schedule('Second');  // Ignored
batchinator.schedule('Third');  // Ignored
// No trailing execution
```

### Flush Scheduled Task

Immediately execute the scheduled task:

```typescript
import Batchinator from '@x-oasis/batchinator';

const batchinator = new Batchinator(callback, 100);

batchinator.schedule('First');
batchinator.schedule('Second');
batchinator.flush();  // Executes immediately with 'Second'

// Or flush with new arguments
batchinator.flush('Custom');
```

### Dispose

Cancel the scheduled task and optionally execute it:

```typescript
import Batchinator from '@x-oasis/batchinator';

const batchinator = new Batchinator(callback, 100);

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
import Batchinator from '@x-oasis/batchinator';

const batchinator = new Batchinator(callback, 100);

batchinator.schedule('First');
console.log(batchinator.inSchedule());  // true

// After execution or cancel
batchinator.flush();
console.log(batchinator.inSchedule());  // false
```

## API

### `new Batchinator(callback, delayMS, options?)`

Creates a new Batchinator instance.

#### Parameters

- `callback` (`Function`): The function to batch.
- `delayMS` (`number`): The delay in milliseconds before executing the batched callback.
- `options` (`Object`, optional): Configuration options.
  - `leading` (`boolean`, default: `false`): Execute immediately on the first call.
  - `trailing` (`boolean`, default: `true`): Execute after the delay period.

#### Returns

Returns a new `Batchinator` instance.

### Instance Methods

#### `schedule(...args)`

Schedule the callback execution with the given arguments. If called multiple times, only the last call's arguments will be used.

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

### React Native Interaction Manager

```typescript
import Batchinator from '@x-oasis/batchinator';

// Batch UI updates to avoid blocking the main thread
const updateUI = (data: any) => {
  // Update UI with data
};

const batchinator = new Batchinator(updateUI, 16, {
  leading: false,
  trailing: true
});

// Multiple rapid updates
for (let i = 0; i < 100; i++) {
  batchinator.schedule({ index: i });
}
// Only the last update executes after 16ms
```

### Form Input Batching

```typescript
import Batchinator from '@x-oasis/batchinator';

const saveForm = (formData: any) => {
  // Save form data
  console.log('Saving:', formData);
};

const batchinator = new Batchinator(saveForm, 500, {
  leading: false,
  trailing: true
});

// User types in form
input.addEventListener('input', (e) => {
  batchinator.schedule({ value: e.target.value });
});
// Form saves 500ms after user stops typing
```

### Immediate Execution with Batching

```typescript
import Batchinator from '@x-oasis/batchinator';

const logMessage = (message: string) => {
  console.log(message);
};

const batchinator = new Batchinator(logMessage, 1000, {
  leading: true,
  trailing: true
});

batchinator.schedule('First');   // Executes immediately
batchinator.schedule('Second');  // Batched
batchinator.schedule('Third');   // Batched
// After 1000ms, 'Third' executes
```

### Cleanup on Component Unmount

```typescript
import Batchinator from '@x-oasis/batchinator';
import { useEffect } from 'react';

function MyComponent() {
  const batchinator = new Batchinator(handleUpdate, 100);

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

## Differences from Debounce/Throttle

- **Batchinator**: Batches multiple calls and executes with the last arguments. Supports leading/trailing execution.
- **Debounce**: Delays execution until after a period of inactivity.
- **Throttle**: Limits execution to at most once per period.

### When to Use Batchinator

- React Native Interaction Manager scenarios
- Batching UI updates
- Form auto-save (with leading: false, trailing: true)
- Event handling where you want immediate feedback but batched processing

## See Also

- [React Native Batchinator](https://github.com/facebook/react-native/blob/main/Libraries/Interaction/Batchinator.js)
- [@x-oasis/debounce](../debounce/README.md) - Creates a debounced function
- [@x-oasis/throttle](../throttle/README.md) - Creates a throttled function
- [@x-oasis/batchinate-last](../batchinate-last/README.md) - Executes with last arguments

## License

ISC
