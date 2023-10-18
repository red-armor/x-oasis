export default (
  ele: HTMLElement,
  elements: Array<HTMLElement>
): {
  index: number;
  element: HTMLElement;
} => {
  let element = ele;

  while (elements.indexOf(element) === -1) {
    element = element.parentElement;
  }

  if (element)
    return {
      index: elements.indexOf(element),
      element,
    };

  return {
    index: -1,
    element: null,
  };
};
