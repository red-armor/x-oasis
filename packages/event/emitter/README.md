# @x-oasis/emitter

A TypeScript event emitter library with support for event management, lifecycle hooks, and integration with DOM and Node.js event emitters.

## Installation

```bash
$ npm i @x-oasis/emitter
```

## API

### `Emitter`

A class that manages multiple named events.

```typescript
class Emitter {
  constructor(props: { name: string });
  get name(): string;
  register(eventName: string, eventProps?: EventProps): Event;
  getEvent(eventName: string): Event | undefined;
  dispose(): void;
}
```

### `Event`

A class representing a single event that can be subscribed to and fired.

```typescript
class Event {
  readonly name: string;
  subscribe(listener: EventListener): IDisposable;
  removeListener(listener: EventListener): void;
  fire(...args: any[]): void;
  dispose(): void;
}
```

### `fromNodeEvent()`

Creates an `Event` from a Node.js event emitter.

```typescript
function fromNodeEvent(emitter: NodeEventEmitter, eventName: string): (listener: EventListener) => IDisposable;
```

### `EventProps`

Configuration options for creating an `Event`.

```typescript
type EventProps = {
  onWillAddFirstListener?: Function;
  onDidAddFirstListener?: Function;
  onDidAddListener?: Function;
  onWillRemoveListener?: Function;
  onDidRemoveLastListener?: Function;
  coldTrigger?: boolean;
};
```

### `EventListener`

Type for event listener functions.

```typescript
type EventListener = Function;
```

## Usage

### Basic Event Usage

```typescript
import { Event } from '@x-oasis/emitter';

// Create an event
const event = new Event({ name: 'myEvent' });

// Subscribe to the event
const disposable = event.subscribe((data) => {
  console.log('Event fired:', data);
});

// Fire the event
event.fire('Hello, World!'); // Logs: "Event fired: Hello, World!"

// Unsubscribe
disposable.dispose();
```

### Using Emitter

```typescript
import { Emitter } from '@x-oasis/emitter';

// Create an emitter
const emitter = new Emitter({ name: 'myEmitter' });

// Register an event
const clickEvent = emitter.register('click');

// Subscribe to the event
const disposable = clickEvent.subscribe((x, y) => {
  console.log(`Clicked at (${x}, ${y})`);
});

// Fire the event
clickEvent.fire(100, 200); // Logs: "Clicked at (100, 200)"

// Get an existing event
const existingEvent = emitter.getEvent('click');
existingEvent?.fire(300, 400); // Logs: "Clicked at (300, 400)"

// Cleanup
emitter.dispose(); // Disposes all events
```

### Multiple Listeners

```typescript
import { Event } from '@x-oasis/emitter';

const event = new Event({ name: 'data' });

// Add multiple listeners
const listener1 = (data: string) => console.log('Listener 1:', data);
const listener2 = (data: string) => console.log('Listener 2:', data);

const disposable1 = event.subscribe(listener1);
const disposable2 = event.subscribe(listener2);

event.fire('Hello'); 
// Logs: "Listener 1: Hello"
// Logs: "Listener 2: Hello"

// Remove a specific listener
event.removeListener(listener1);

event.fire('World'); 
// Logs: "Listener 2: World"
```

### Lifecycle Hooks

```typescript
import { Event } from '@x-oasis/emitter';

const event = new Event({
  name: 'lifecycle',
  onWillAddFirstListener: () => {
    console.log('First listener is about to be added');
  },
  onDidAddFirstListener: () => {
    console.log('First listener was added');
  },
  onDidAddListener: () => {
    console.log('A listener was added');
  },
  onWillRemoveListener: () => {
    console.log('A listener is about to be removed');
  },
  onDidRemoveLastListener: () => {
    console.log('Last listener was removed');
  },
});

const disposable1 = event.subscribe(() => {});
// Logs: "First listener is about to be added"
// Logs: "First listener was added"
// Logs: "A listener was added"

const disposable2 = event.subscribe(() => {});
// Logs: "A listener was added"

disposable1.dispose();
// Logs: "A listener is about to be removed"

disposable2.dispose();
// Logs: "A listener is about to be removed"
// Logs: "Last listener was removed"
```

### Cold Trigger

When `coldTrigger` is enabled, new subscribers will immediately receive the last fired value.

```typescript
import { Event } from '@x-oasis/emitter';

const event = new Event({
  name: 'state',
  coldTrigger: true,
});

// Fire before any listeners
event.fire('initial state');

// New listener receives the last value immediately
event.subscribe((state) => {
  console.log('Current state:', state); // Logs: "Current state: initial state"
});

// Fire again
event.fire('updated state'); // Logs: "Current state: updated state"
```

### Integration with Node.js Event Emitter

```typescript
import { fromNodeEvent } from '@x-oasis/emitter';
import { EventEmitter } from 'events';

const nodeEmitter = new EventEmitter();
const subscribe = fromNodeEvent(nodeEmitter, 'data');

// Subscribe to the Node.js event
const disposable = subscribe((data) => {
  console.log('Received:', data);
});

// Emit from Node.js emitter
nodeEmitter.emit('data', 'Hello from Node.js'); // Logs: "Received: Hello from Node.js"

// Unsubscribe
disposable.dispose();
```

### Managing Multiple Events

```typescript
import { Emitter } from '@x-oasis/emitter';

const emitter = new Emitter({ name: 'app' });

// Register multiple events
const clickEvent = emitter.register('click');
const hoverEvent = emitter.register('hover');
const keydownEvent = emitter.register('keydown');

// Subscribe to different events
clickEvent.subscribe((x, y) => {
  console.log('Click:', x, y);
});

hoverEvent.subscribe((element) => {
  console.log('Hover:', element);
});

keydownEvent.subscribe((key) => {
  console.log('Key:', key);
});

// Fire events
clickEvent.fire(100, 200);
hoverEvent.fire(document.body);
keydownEvent.fire('Enter');

// Cleanup all events at once
emitter.dispose();
```

## Examples

### Event-Driven Component

```typescript
import { Emitter } from '@x-oasis/emitter';

class Component {
  private emitter = new Emitter({ name: 'Component' });

  on(eventName: string, listener: Function) {
    const event = this.emitter.register(eventName);
    return event.subscribe(listener);
  }

  emit(eventName: string, ...args: any[]) {
    const event = this.emitter.getEvent(eventName);
    event?.fire(...args);
  }

  destroy() {
    this.emitter.dispose();
  }
}

// Usage
const component = new Component();

component.on('update', (data) => {
  console.log('Updated:', data);
});

component.emit('update', { value: 42 });
```

### State Management with Cold Trigger

```typescript
import { Event } from '@x-oasis/emitter';

class StateManager {
  private stateEvent = new Event({
    name: 'state',
    coldTrigger: true,
  });

  private state = { count: 0 };

  getState() {
    return this.state;
  }

  subscribe(listener: (state: any) => void) {
    return this.stateEvent.subscribe(listener);
  }

  setState(newState: any) {
    this.state = { ...this.state, ...newState };
    this.stateEvent.fire(this.state);
  }
}

// Usage
const manager = new StateManager();
manager.setState({ count: 1 });

// New subscriber gets current state immediately
manager.subscribe((state) => {
  console.log('State:', state); // Logs: "State: { count: 1 }"
});
```

### Integration with DOM Events

```typescript
import { Event } from '@x-oasis/emitter';

// Create a DOM event wrapper
function createDomEvent(element: HTMLElement, eventName: string) {
  const event = new Event({
    name: eventName,
    onWillAddFirstListener: () => {
      element.addEventListener(eventName, handler);
    },
    onDidRemoveLastListener: () => {
      element.removeEventListener(eventName, handler);
    },
  });

  const handler = (e: Event) => {
    event.fire(e);
  };

  return event.subscribe;
}

// Usage
const button = document.querySelector('#myButton');
if (button) {
  const subscribe = createDomEvent(button, 'click');
  const disposable = subscribe((e) => {
    console.log('Button clicked!', e);
  });

  // Later, unsubscribe
  disposable.dispose();
}
```
