import { expect, describe, it } from 'vitest';
import uniqueArrayObject from '../src';

describe('basic', () => {
  it('basic ', () => {
    const state = [
      {
        name: 'viewable',
        value: 7,
      },
      {
        name: 'imageViewable',
        value: 9,
      },
      {
        name: 'viewable',
        value: 8,
      },
    ];

    expect(uniqueArrayObject(state, (item) => item.name)).toEqual([
      {
        name: 'imageViewable',
        value: 9,
      },
      {
        name: 'viewable',
        value: 8,
      },
    ]);

    expect(uniqueArrayObject(state, 'name')).toEqual([
      {
        name: 'imageViewable',
        value: 9,
      },
      {
        name: 'viewable',
        value: 8,
      },
    ]);
  });

  it('basic - keepLast', () => {
    const state = [
      {
        name: 'viewable',
        value: 7,
      },
      {
        name: 'imageViewable',
        value: 9,
      },
      {
        name: 'viewable',
        value: 8,
      },
    ];

    expect(uniqueArrayObject(state, (item) => item.name, true)).toEqual([
      {
        name: 'viewable',
        value: 7,
      },
      {
        name: 'imageViewable',
        value: 9,
      },
    ]);

    expect(uniqueArrayObject(state, 'name', true)).toEqual([
      {
        name: 'viewable',
        value: 7,
      },
      {
        name: 'imageViewable',
        value: 9,
      },
    ]);
  });
});
