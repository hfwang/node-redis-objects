var BaseObject = require('./BaseObject');

function Value(key, myRedis, options) {
  BaseObject.apply(this, arguments);

  if (this.options.default) {
    this.redis().setnx(this.key, this.toRedis(this.options.default));
  }
};

module.exports = exports = Value;

exports.prototype = Object.create(BaseObject.prototype);
exports.prototype.constructor = exports;

exports.prototype.setValue = function(value, callback) {
  this.redis().set(this.key, this.toRedis(value), callback);
};
exports.prototype.set = exports.prototype.setValue;

exports.prototype.getValue = function(callback) {
  this.redis().get(this.key, this.makeCallback(callback));
};
exports.prototype.get = exports.prototype.getValue;
