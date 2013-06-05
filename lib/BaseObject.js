module.exports = exports = function BaseObject(key, myRedis, options) {
  this.key = key;

  if (myRedis && !options) {
    options = myRedis;
    myRedis = null;
  }
  if (!options) options = {};

  this.options = options;
  this.myRedis = myRedis;
};

exports.prototype.redis = function() {
  return this.myRedis || require('../index').connect();
};

exports.prototype.inspect = function() {
  return '#<' + this.constructor.name + ' key: ' + this.key + ' opts: ' + JSON.stringify(this.options) + '>';
};

require('./serialize').mixin(exports);
