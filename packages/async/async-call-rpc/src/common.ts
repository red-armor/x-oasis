import { isUpperAsciiLetter } from '@x-oasis/is-ascii';

export const isEventMethod = (name: string) => {
  if (typeof name !== 'string') return false;
  return (
    name[0] === 'o' && name[1] === 'n' && isUpperAsciiLetter(name.charCodeAt(2))
  );
};

export const isAssignPassingPortMethod = (name: string) => {
  return name === 'assignPassingPort';
};

export const isAcquirePortMethod = (name: string) => {
  return name.startsWith('acquire') && name.endsWith('Port');
};

export const isOptionsMethod = (name: string) => {
  return name.endsWith('Options') || name.endsWith('OptionsRequest');
};
