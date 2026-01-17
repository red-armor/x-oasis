import { isUpperAsciiLetter } from '@x-oasis/is-ascii';

export const isEventMethod = (name: string) => {
  if (typeof name !== 'string') return false;
  return (
    name[0] === 'o' && name[1] === 'n' && isUpperAsciiLetter(name.charCodeAt(2))
  );
};

export const isAssignPassingPortMethod = (name: string) => {
  return /^assignPassingPort$/.test(name);
};

export const isAcquirePortMethod = (name: string) => {
  return /^acquire.*Port$/.test(name);
};

export const isOptionsMethod = (name: string) => {
  return /Options$/.test(name) || /OptionsRequest$/.test(name);
};
