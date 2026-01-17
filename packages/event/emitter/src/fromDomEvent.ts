import Event from './Event';

export interface DomEventEmitter {
  addEventListener(event: string | symbol, listener: Function): unknown;
  removeEventListener(event: string | symbol, listener: Function): unknown;
}

/**
 * Creates an {@link Event} from a window event emitter.
 */
export function fromDomEvent(emitter: DomEventEmitter, eventName: string) {
  // @ts-ignore
  const onFirstListenerAdd = () => emitter.addEventListener(eventName, fn);
  const onLastListenerRemove = () => emitter.removeEventListener(eventName, fn);
  const event = new Event({
    name: eventName,
    onWillAddFirstListener: onFirstListenerAdd,
    onDidRemoveLastListener: onLastListenerRemove,
  });

  const fn = (...args: any[]) => {
    return event.fire(...args);
  };

  return event.subscribe;
}
