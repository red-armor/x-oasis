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
  type?: string;
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

export const buildDiscreteData = (count: number, label?: string) => {
  const _label = label || 'item';
  const prefix = Date.now();
  const arr = [] as Array<Item>;
  for (let i = 0; i < count; i++) {
    const _i = `${prefix}_${i}`;
    let type = 'default';
    if (!(i % 10)) type = 'mod10';
    else if (!(i % 2)) type = 'mod2';
    else if (!(i % 3)) type = 'mod3';

    arr.push({
      key: `${_label}_${_i}`,
      index: _i,
      type,
    });
  }
  return arr;
};
