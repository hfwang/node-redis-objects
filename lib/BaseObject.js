var aliasMethod = require('./util').aliasMethod.bind(undefined, BaseObject);

function BaseObject(key, myRedis, options) {
  this.key = key;

  if (myRedis && !options) {
    options = myRedis;
    myRedis = null;
  }
  if (!options) options = {};

  this.options = options;
  this.myRedis = myRedis;
}

module.exports = exports = BaseObject;

exports.prototype.redis = function() {
  return this.myRedis || require('../index').connect();
};

exports.prototype.inspect = function() {
  return '#<' + this.constructor.name + ' key: ' + this.key + '>';
};

exports.prototype.clear = function(callback) {
  this.redis().del(this.key, callback);
};

require('./serialize').mixin(exports);
