import { ModuleIdentifier } from '../types';

export const DUPLICATED_INJECTABLE_DECORATOR =
  'Cannot apply @injectable decorator multiple times.';
// @ts-ignore
export const INSTANTIATE_FACTORY_SERVICE = (id: ModuleIdentifier) =>
  `Cannot instantiate ${String(id)} factory service, use 'get' method instead`;
export const BINDING_NOT_FOUND = (id: ModuleIdentifier, index: number) =>
  // @ts-ignore
  `[instantiate error ] ${String(
    id
  )}(index: ${index}) cannot find corresponding binding`;
