# @x-oasis/debounce

Creates a debounced function that delays invoking `func` until after `wait` milliseconds have elapsed since the last time the debounced function was invoked.

## Installation

```bash
npm install @x-oasis/debounce
# or
pnpm add @x-oasis/debounce
# or
yarn add @x-oasis/debounce
```

## Usage

### Basic Usage

```typescript
import debounce from '@x-oasis/debounce';

// Avoid costly calculations while the window size is in flux.
const calculateLayout = () => {
  // Expensive layout calculation
};

const debounced = debounce(calculateLayout, 150);
window.addEventListener('resize', debounced);
```

### With Options

```typescript
import debounce from '@x-oasis/debounce';

const sendMail = (email: string) => {
  console.log('Sending email to:', email);
};

// Invoke `sendMail` when clicked, debouncing subsequent calls.
const debounced = debounce(sendMail, 300, {
  leading: true,
  trailing: false
});

debounced('user@example.com');
```

### Cancel and Flush

The debounced function comes with a `cancel` method to cancel delayed `func` invocations and a `flush` method to immediately invoke them.

```typescript
import debounce from '@x-oasis/debounce';

const debounced = debounce(calculateLayout, 150);

// Cancel the trailing debounced invocation.
debounced.cancel();

// Flush the trailing debounced invocation.
debounced.flush();
```

### MaxWait

Ensure `batchLog` is invoked at most once per 250ms, but at least once per 1000ms.

```typescript
import debounce from '@x-oasis/debounce';

const batchLog = (message: string) => {
  console.log(message);
};

const debounced = debounce(batchLog, 250, { maxWait: 1000 });
```

## API

### `debounce(func, wait, options?)`

Creates a debounced function that delays invoking `func` until after `wait` milliseconds have elapsed since the last time the debounced function was invoked.

#### Parameters

- `func` (`Function`): The function to debounce.
- `wait` (`number`): The number of milliseconds to delay.
- `options` (`Object`, optional): The options object.
  - `leading` (`boolean`, default: `false`): Specify invoking on the leading edge of the timeout.
  - `trailing` (`boolean`, default: `true`): Specify invoking on the trailing edge of the timeout.
  - `maxWait` (`number`, optional): The maximum time `func` is allowed to be delayed before it's invoked.

#### Returns

Returns the new debounced function with the following methods:

- `cancel()`: Cancels delayed `func` invocations.
- `flush()`: Immediately invokes the delayed `func` invocation.

## Examples

### Search Input

```typescript
import debounce from '@x-oasis/debounce';

const search = (query: string) => {
  // Perform search
  console.log('Searching for:', query);
};

const debouncedSearch = debounce(search, 300);

// User types in search box
debouncedSearch('react');
debouncedSearch('react hooks');
debouncedSearch('react hooks tutorial');
// Only the last call will execute after 300ms
```

### Button Click

```typescript
import debounce from '@x-oasis/debounce';

const handleClick = () => {
  console.log('Button clicked');
};

// Execute immediately on first click, ignore subsequent clicks for 1 second
const debouncedClick = debounce(handleClick, 1000, {
  leading: true,
  trailing: false
});
```

### Resize Handler

```typescript
import debounce from '@x-oasis/debounce';

const handleResize = () => {
  // Recalculate layout
  console.log('Window resized');
};

const debouncedResize = debounce(handleResize, 200);

window.addEventListener('resize', debouncedResize);

// Cleanup
window.removeEventListener('resize', debouncedResize);
debouncedResize.cancel();
```

## See Also

- [Lodash debounce](https://lodash.com/docs/#debounce)
- [@x-oasis/throttle](../throttle/README.md) - Creates a throttled function

## License

ISC
