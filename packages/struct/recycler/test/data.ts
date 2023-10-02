let startIndex = 0;

export const resetStartIndex = () => (startIndex = 0);

export const buildSimpleList = (count: number) => {
  const arr = [] as Array<number>;
  for (let i = 0; i < count; i++) {
    arr.push(startIndex);
    startIndex += 1;
  }
  return arr;
};

export type Item = {
  key: string;
  index: number;
  type?: string;
};

export const buildDiscreteData = (count: number, label?: string) => {
  const _label = label || 'item';
  const arr = [] as Array<Item>;
  for (let i = 0; i < count; i++) {
    let type = 'default';
    if (!(i % 5)) type = 'mod5';
    else if (!(i % 2)) type = 'mod2';
    else if (!(i % 3)) type = 'mod3';
    else if (!(i % 7)) type = 'mod7';

    arr.push({
      key: `${_label}_${startIndex}`,
      index: startIndex,
      type,
    });
    startIndex += 1;
  }
  return arr;
};
