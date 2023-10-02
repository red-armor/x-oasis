import deleteSuite from './delete';

import {
  buildSimpleList,
  buildItemData,
  buildDiscreteData,
  resetStartIndex,
} from './data';
import { discreteSuite, basicSuite } from './basic';

const data = {
  values: [] as Array<any>,
};

deleteSuite('simple list', data, {
  hooks: {
    beforeEach: () => {
      resetStartIndex();
      data.values = buildSimpleList(12);
    },
  },
  data: {
    delete: (index) => data.values.splice(index, 1),
    append: (count) => {
      data.values = data.values.concat(buildSimpleList(count));
    },
  },
});

deleteSuite('item list', data, {
  hooks: {
    beforeEach: () => {
      resetStartIndex();
      data.values = buildItemData(12);
    },
  },
  data: {
    delete: (index) => data.values.splice(index, 1),
    append: (count) => {
      data.values = data.values.concat(buildItemData(count));
    },
  },
});

basicSuite('basic', data, {
  hooks: {
    beforeEach: () => {
      resetStartIndex();
      data.values = buildSimpleList(100);
    },
  },
  data: {
    delete: (index) => data.values.splice(index, 1),
    append: (count) => {
      data.values = data.values.concat(buildSimpleList(count));
    },
  },
});

discreteSuite('simple', data, {
  hooks: {
    beforeEach: () => {
      resetStartIndex();
      data.values = buildDiscreteData(100);
    },
  },
  data: {
    delete: (index) => data.values.splice(index, 1),
    append: (count) => {
      data.values = data.values.concat(buildDiscreteData(count));
    },
  },
});
