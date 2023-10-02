// Built-in `isNaN` returns true for values that are not the value NaN but
// are not numbers either
export default (val: any) => val !== val;
