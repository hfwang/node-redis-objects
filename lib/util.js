exports.aliasMethod = function(klass, newName, oldName) {
  klass.prototype[newName] = klass.prototype[oldName];
};
