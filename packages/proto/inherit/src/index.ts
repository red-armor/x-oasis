export default (
  subClass: {
    prototype: any;
    // __proto__: any;
  },
  superClass: {
    prototype: any;
  }
) => {
  subClass.prototype = Object.create(superClass.prototype);
  subClass.prototype.constructor = subClass;
  // subClass.__proto__ = superClass // eslint-disable-line
};
