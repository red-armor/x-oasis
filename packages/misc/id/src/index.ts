const seenKeys: {
  [key: string]: true;
} = {};
const MULTIPLIER = Math.pow(2, 24); // eslint-disable-line
export const generateRandomKey = () => {
  let key;

  while (key === undefined || seenKeys[key]) {
    key = Math.floor(Math.random() * MULTIPLIER).toString(32);
  }

  seenKeys[key] = true;
  return key;
};

export const buildId = (entry: string, id: string | number) => `${entry}.${id}`;
