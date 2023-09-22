import { buildDiscreteData, resetStartIndex } from './data';
import { basicSuite } from './recycler';

const data = {
  values: [] as Array<any>,
};

basicSuite('simple', data, {
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
