# @x-oasis/disposable

A TypeScript library for managing disposable resources. Provides utilities for creating, managing, and disposing of resources that need cleanup.

## Installation

```bash
$ npm i @x-oasis/disposable
```

## API

### `IDisposable`

Interface for objects that can be disposed.

```typescript
interface IDisposable {
  dispose(): void;
}
```

### `Disposable`

A class that implements `IDisposable` and can register other disposables to be disposed together.

```typescript
class Disposable implements IDisposable {
  static readonly None: IDisposable; // A no-op disposable
  dispose(): void;
  registerDisposable<T extends IDisposable>(disposable: T): T;
}
```

### `DisposableStore`

A store that manages multiple disposables and can dispose them all at once.

```typescript
class DisposableStore implements IDisposable {
  dispose(): void;
  get isDisposed(): boolean;
  clear(): void;
  add<T extends IDisposable>(thing: T): T;
  delete<T extends IDisposable>(thing: T): void;
}
```

### `dispose()`

A utility function to dispose of a single disposable, an array of disposables, or an iterable of disposables.

```typescript
function dispose<T extends IDisposable>(disposable: T): T;
function dispose<T extends IDisposable>(disposable: T | undefined): T | undefined;
function dispose<T extends IDisposable>(arg: T | Iterable<T> | undefined): any;
```

### `isDisposable()`

Type guard to check if an object implements `IDisposable`.

```typescript
function isDisposable<T extends object>(thing: T): thing is T & IDisposable;
```

### `toDisposable()`

Converts a function to an `IDisposable` that will call the function when disposed.

```typescript
function toDisposable(fn: Function): IDisposable;
```

## Usage

### Basic Usage

```typescript
import { Disposable, DisposableStore, dispose, toDisposable, isDisposable } from '@x-oasis/disposable';

// Create a simple disposable
const disposable = toDisposable(() => {
  console.log('Cleaned up!');
});

// Dispose it
disposable.dispose(); // Logs: "Cleaned up!"

// Use Disposable class
const disposableObj = new Disposable();
disposableObj.registerDisposable(toDisposable(() => {
  console.log('Resource 1 cleaned');
}));
disposableObj.registerDisposable(toDisposable(() => {
  console.log('Resource 2 cleaned');
}));

disposableObj.dispose(); // Both resources are cleaned
```

### Using DisposableStore

```typescript
import { DisposableStore, toDisposable } from '@x-oasis/disposable';

const store = new DisposableStore();

// Add disposables to the store
const cleanup1 = toDisposable(() => console.log('Cleanup 1'));
const cleanup2 = toDisposable(() => console.log('Cleanup 2'));

store.add(cleanup1);
store.add(cleanup2);

// Check if disposed
console.log(store.isDisposed); // false

// Dispose all at once
store.dispose(); // Logs: "Cleanup 1", "Cleanup 2"
console.log(store.isDisposed); // true

// Clear without disposing
store.clear(); // Removes all disposables without calling dispose()
```

### Disposing Multiple Resources

```typescript
import { dispose, toDisposable } from '@x-oasis/disposable';

// Dispose an array
const disposables = [
  toDisposable(() => console.log('1')),
  toDisposable(() => console.log('2')),
  toDisposable(() => console.log('3')),
];

dispose(disposables); // All three are disposed

// Dispose a Set
const disposableSet = new Set([
  toDisposable(() => console.log('A')),
  toDisposable(() => console.log('B')),
]);

dispose(disposableSet); // Both are disposed

// Dispose a single disposable
const single = toDisposable(() => console.log('Single'));
dispose(single); // Disposed
```

### Type Guard

```typescript
import { isDisposable } from '@x-oasis/disposable';

const obj = {
  dispose() {
    console.log('Disposed');
  },
};

if (isDisposable(obj)) {
  // TypeScript now knows obj is IDisposable
  obj.dispose();
}
```

### Disposable.None

```typescript
import { Disposable } from '@x-oasis/disposable';

// A no-op disposable that does nothing when disposed
const none = Disposable.None;
none.dispose(); // Does nothing, no error
```

## Examples

### Managing Event Listeners

```typescript
import { DisposableStore, toDisposable } from '@x-oasis/disposable';

class Component {
  private store = new DisposableStore();

  setup() {
    const button = document.querySelector('#myButton');
    
    const handler = () => console.log('Clicked');
    button?.addEventListener('click', handler);
    
    // Register cleanup
    this.store.add(toDisposable(() => {
      button?.removeEventListener('click', handler);
    }));
  }

  destroy() {
    this.store.dispose(); // All event listeners are removed
  }
}
```

### Managing Subscriptions

```typescript
import { Disposable, toDisposable } from '@x-oasis/disposable';

class Service {
  private disposable = new Disposable();

  subscribe(callback: () => void) {
    const subscription = createSubscription(callback);
    
    this.disposable.registerDisposable(toDisposable(() => {
      subscription.unsubscribe();
    }));
    
    return subscription;
  }

  cleanup() {
    this.disposable.dispose(); // All subscriptions are unsubscribed
  }
}
```
