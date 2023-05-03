// https://stackoverflow.com/a/56757215

export default (
  arr: Array<{
    [key: string]: any;
  }>,
  getter: string | Function
) => {
  return [
    ...new Map(
      arr
        .filter((v) => v)
        .map((item) => [
          typeof getter === 'function' ? getter(item) : item[getter],
          item,
        ])
    ).values(),
  ];
};
