// import IntegerBufferSet, { defaultBufferSize } from '../src';
// import { describe, it, expect, beforeAll } from 'vitest';
import { buildSimpleList } from './data';

// const extractTokenTargetIndex = (val) => val.map((v) => v.targetIndex);

import basicSuite from './basic';
import deleteSuite from './delete';

const data = {
  values: [] as Array<any>,
};

deleteSuite({
  beforeAll: () => {
    data.values = buildSimpleList(12);
  },
});

deleteSuite({
  beforeAll: () => {
    data.values = buildSimpleList(12);
  },
});

basicSuite();
