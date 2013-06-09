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

exports.prototype.exists = function(callback) {
  this.redis().exists(this.key, callback);
}

exports.prototype.clear = function(callback) {
  this.redis().del(this.key, callback);
};
aliasMethod('del', 'clear');
aliasMethod('delete', 'clear');

exports.prototype.type = function(callback) {
  this.redis().type(this.key, callback);
};

exports.prototype.rename = function(name, setKey, callback) {
  if (_.isFunction(setKey)) {
    callback = setKey;
    setKey = null;
  }
  if (typeof(setKey) != "undefined" && setKey != null) {
    setKey = true;
  }
  var dest = ('key' in name) ? name.key : name;
  this.redis().rename(this.key, dest, function(e, res) {
    if (res && setKey) {
      this.key = dest;
    }
    if (callback) callback(e, res);
  });
};

exports.prototype.renamenx = function(name, setKey, callback) {
  if (_.isFunction(setKey)) {
    callback = setKey;
    setKey = null;
  }
  if (typeof(setKey) != "undefined" && setKey != null) {
    setKey = true;
  }
  var dest = ('key' in name) ? name.key : name;
  this.redis().renamenx(this.key, dest, function(e, res) {
    if (res && setKey) {
      this.key = dest;
    }
    if (callback) callback(e, res);
  });
};

exports.prototype.expire = function(seconds, callback) {
  this.redis().expire(this.key, seconds, callback);
};

exports.prototype.expireat = function(unixtime, callback) {
  this.redis().expireat(this.key, unixtime, callback);
};

exports.prototype.persist = function(callback) {
  this.redis().persist(this.key, callback);
};

exports.prototype.ttl = function(callback) {
  this.redis().ttl(this.key, callback);
};

require('./serialize').mixin(exports);
