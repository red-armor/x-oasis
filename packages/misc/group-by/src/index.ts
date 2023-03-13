const hasOwnProperty = Object.prototype.hasOwnProperty
/**
 * @param list the collection that the method iterates over.
 * @param fn the function that is invoked for every element in the array.
 * @returns
 */
function groupBy(list: any[], fn: Function) {
  return list.reduce((acc, val) => {
    const key = fn(val)
    acc[key] = acc[key] || []
    acc[key].push(val)
    return acc
  }, {})
}

export default groupBy
