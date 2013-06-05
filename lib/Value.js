var BaseObject = require('./BaseObject');
var serialize = require('./serialize');

module.exports = exports = function Value(key, myRedis, options) {
  BaseObject.apply(this, arguments);

  if (this.options.default) {
    this.redis().setnx(this.key(), this.options.default);
  }
};

exports.prototype = Object.create(BaseObject.prototype);
exports.prototype.constructor = exports;

exports.prototype.setValue = function(value, callback) {
  this.redis().set(this.key, this.toRedis(value), callback);
};

exports.prototype.getValue = function(callback) {
  this.redis().get(this.key, this.makeCallback(callback));
};
