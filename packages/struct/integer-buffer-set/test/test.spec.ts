import { buildDiscreteData } from './data';
import { discreteSuite } from './basic';

const data = {
  values: [] as Array<any>,
};

// deleteSuite('simple list', data, {
//   hooks: {
//     beforeEach: () => {
//       console.log('before all ');

//       data.values = buildSimpleList(12);
//     },
//   },
//   data: {
//     delete: (index) => data.values.splice(index, 1),
//     append: (count) => {
//       data.values = data.values.concat(buildSimpleList(count));
//     },
//   },
// });

// deleteSuite('item list', data, {
//   hooks: {
//     beforeEach: () => {
//       data.values = buildItemData(12);
//     },
//   },
//   data: {
//     delete: (index) => data.values.splice(index, 1),
//     append: (count) => {
//       data.values = data.values.concat(buildItemData(count));
//     },
//   },
// });

// basicSuite();

discreteSuite('simple', data, {
  hooks: {
    beforeEach: () => {
      console.log('before all ');
      data.values = buildDiscreteData(100);
    },
  },
});
