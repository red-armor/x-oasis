// addEventListener<K extends keyof WindowEventMap>
// (type: K, listener: (this: Window, ev: WindowEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;

// export interface Binding <K extends keyof WindowEventMap>{
//   eventName: K;
//   fn: (this: Window, ev: WindowEventMap[K]) => any;
//   options?: boolean | AddEventListenerOptions
// }
export interface Binding {
  eventName: string;
  fn: (e: MouseEvent) => any;
  options?: AddEventListenerOptions;
}

// https://github.com/atlassian/react-beautiful-dnd/blob/master/src/view/event-bindings/bind-events.js

function getOptions(
  shared?: AddEventListenerOptions,
  fromBinding?: AddEventListenerOptions
) {
  return {
    ...shared,
    ...fromBinding,
  };
}

export default function bindEvents(
  el: HTMLElement | Window | Document,
  bindings: Binding[] | Binding,
  sharedOptions?: AddEventListenerOptions
) {
  const empty = [] as Binding[];
  const nextBindings = empty.concat(bindings);
  const unBindings = nextBindings.map((binding) => {
    const options = getOptions(sharedOptions, binding.options);
    // ts-hint: https://github.com/microsoft/TypeScript/issues/28357#issuecomment-436484705
    el.addEventListener(
      binding.eventName,
      binding.fn as EventListener,
      options
    );

    return function unbind() {
      el.removeEventListener(
        binding.eventName,
        binding.fn as EventListener,
        options
      );
    };
  });

  // Return a function to unbind events
  return function unbindAll() {
    unBindings.forEach((unbind) => unbind());
  };
}

// once event triggered. it will be teardown first...
export function bindEventsOnce(
  el: HTMLElement,
  bindings: Binding[] | Binding,
  sharedOptions?: AddEventListenerOptions
) {
  const empty = [] as Binding[];
  const nextBindings = empty.concat(bindings);
  const unBindings = nextBindings.map((binding) => {
    const options = getOptions(sharedOptions, binding.options);
    let unbind = () => {};

    const wrappedFn = (e: MouseEvent) => {
      binding.fn.call(null, e);
      unbind();
    };

    el.addEventListener(binding.eventName, wrappedFn as EventListener, options);

    unbind = () =>
      el.removeEventListener(
        binding.eventName,
        wrappedFn as EventListener,
        options
      );

    return unbind;
  });

  // Return a function to unbind events
  return function unbindAll() {
    unBindings.forEach((unbind) => unbind());
  };
}
