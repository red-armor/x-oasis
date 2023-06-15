export default (o: any) =>
  typeof Reflect !== 'undefined' && Reflect.ownKeys
    ? Reflect.ownKeys(o)
    : typeof Object.getOwnPropertySymbols !== 'undefined'
    ? Object.getOwnPropertyNames(o).concat(
        Object.getOwnPropertySymbols(o) as any
      )
    : Object.getOwnPropertyNames(o);
