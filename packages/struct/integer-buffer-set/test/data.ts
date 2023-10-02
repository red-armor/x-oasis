export const buildSimpleList = (count: number) => {
  const arr = [] as Array<string>;
  const prefix = Date.now();
  for (let i = 0; i < count; i++) {
    arr.push(`${prefix}_${i}`);
  }
  return arr;
};

export type Item = {
  key: string;
  index: string;
};

export const buildItemData = (count: number, label?: string) => {
  const _label = label || 'item';
  const prefix = Date.now();
  const arr = [] as Array<Item>;
  for (let i = 0; i < count; i++) {
    const _i = `${prefix}_${i}`;
    arr.push({
      key: `${_label}_${_i}`,
      index: _i,
    });
  }
  return arr;
};
