# @x-oasis/throttle

Creates a throttled function that only invokes `func` at most once per every `wait` milliseconds.

## Installation

```bash
npm install @x-oasis/throttle
# or
pnpm add @x-oasis/throttle
# or
yarn add @x-oasis/throttle
```

## Usage

### Basic Usage

```typescript
import throttle from '@x-oasis/throttle';

// Avoid excessively updating the position while scrolling.
const updatePosition = () => {
  // Update scroll position
};

const throttled = throttle(updatePosition, 100);
window.addEventListener('scroll', throttled);
```

### With Options

```typescript
import throttle from '@x-oasis/throttle';

const renewToken = () => {
  // Renew authentication token
};

// Invoke `renewToken` when the click event is fired, but not more than once every 5 minutes.
const throttled = throttle(renewToken, 300000, {
  trailing: false
});
```

### Cancel and Flush

The throttled function comes with a `cancel` method to cancel delayed `func` invocations and a `flush` method to immediately invoke them.

```typescript
import throttle from '@x-oasis/throttle';

const throttled = throttle(updatePosition, 100);

// Cancel the trailing throttled invocation.
throttled.cancel();

// Flush the trailing throttled invocation.
throttled.flush();
```

## API

### `throttle(func, wait, options?)`

Creates a throttled function that only invokes `func` at most once per every `wait` milliseconds.

#### Parameters

- `func` (`Function`): The function to throttle.
- `wait` (`number`, default: `0`): The number of milliseconds to throttle invocations to.
- `options` (`Object`, optional): The options object.
  - `leading` (`boolean`, default: `true`): Specify invoking on the leading edge of the timeout.
  - `trailing` (`boolean`, default: `true`): Specify invoking on the trailing edge of the timeout.

#### Returns

Returns the new throttled function with the following methods:

- `cancel()`: Cancels delayed `func` invocations.
- `flush()`: Immediately invokes the delayed `func` invocation.

## Examples

### Scroll Handler

```typescript
import throttle from '@x-oasis/throttle';

const handleScroll = () => {
  // Update UI based on scroll position
  console.log('Scroll position:', window.scrollY);
};

const throttledScroll = throttle(handleScroll, 100);

window.addEventListener('scroll', throttledScroll);

// Cleanup
window.removeEventListener('scroll', throttledScroll);
throttledScroll.cancel();
```

### Mouse Move Handler

```typescript
import throttle from '@x-oasis/throttle';

const handleMouseMove = (event: MouseEvent) => {
  // Track mouse position
  console.log('Mouse position:', event.clientX, event.clientY);
};

const throttledMouseMove = throttle(handleMouseMove, 50);

document.addEventListener('mousemove', throttledMouseMove);
```

### Leading and Trailing

```typescript
import throttle from '@x-oasis/throttle';

const logMessage = (message: string) => {
  console.log(message);
};

// Execute immediately on first call, then wait for trailing edge
const throttled = throttle(logMessage, 1000, {
  leading: true,
  trailing: true
});

throttled('First');  // Executes immediately
throttled('Second'); // Ignored
throttled('Third');  // Ignored
// After 1000ms, 'Third' executes (trailing edge)

// Only execute on trailing edge
const trailingOnly = throttle(logMessage, 1000, {
  leading: false,
  trailing: true
});

trailingOnly('First');  // Not executed immediately
trailingOnly('Second'); // Not executed
trailingOnly('Third');  // Not executed
// After 1000ms, 'Third' executes
```

## Differences from Debounce

- **Throttle**: Executes the function at most once per `wait` milliseconds, regardless of how many times it's called.
- **Debounce**: Delays execution until after `wait` milliseconds have elapsed since the last invocation.

### When to Use Throttle

- Scroll events
- Mouse move events
- Window resize events (when you want periodic updates)
- API calls that should happen at regular intervals

### When to Use Debounce

- Search input (wait for user to stop typing)
- Button clicks (prevent double-clicks)
- Window resize events (when you only care about the final size)

## See Also

- [Lodash throttle](https://lodash.com/docs/#throttle)
- [@x-oasis/debounce](../debounce/README.md) - Creates a debounced function

## License

ISC
