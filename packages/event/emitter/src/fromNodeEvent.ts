import Event from './Event';

export interface NodeEventEmitter {
  on(event: string | symbol, listener: Function): unknown;
  removeListener(event: string | symbol, listener: Function): unknown;
}

/**
 * Creates an {@link Event} from a node event emitter.
 */
export function fromNodeEvent(emitter: NodeEventEmitter, eventName: string) {
  // @ts-ignore
  const onFirstListenerAdd = () => emitter.on(eventName, fn);
  const onLastListenerRemove = () => emitter.removeListener(eventName, fn);
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
