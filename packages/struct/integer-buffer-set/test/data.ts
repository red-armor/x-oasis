export const buildSimpleList = (count: number) => {
  const arr = [] as Array<number>;
  for (let i = 0; i < count; i++) {
    arr.push(i);
  }
  return arr;
};

export type Item = {
  key: string;
  index: number;
};

export const buildItemData = (count: number, label?: string) => {
  const _label = label || 'item';
  const arr = [] as Array<Item>;
  for (let i = 0; i < count; i++) {
    arr.push({
      key: `${_label}_${i}`,
      index: i,
    });
  }
  return arr;
};
