var _ = require('underscore');
var BaseObject = require('./BaseObject');
var aliasMethod = require('./util').aliasMethod.bind(undefined, Hash);

function Hash(key, myRedis, options) {
  BaseObject.apply(this, arguments);

  if (this.options.default) {
    this.redis().setnx(this.key, this.toRedis(this.options.default));
  }

  if (!this.options.marshalKeys) {
    this.options.marshalKeys = {};
  }
}
module.exports = exports = Hash;


exports.prototype = Object.create(BaseObject.prototype);
exports.prototype.constructor = exports;

exports.prototype.set = function(field, value, callback) {
  this.redis().hset(
      this.key, field, this.toRedis(value, this.options.marshalKeys[field]),
      callback);
};
aliasMethod('put', 'set');
aliasMethod('store', 'set');

exports.prototype.get = function(field, callback) {
  this.redis().hget(this.key, field, this.makeCallback(callback, this.options.marshalKeys[field]));
};
aliasMethod('fetch', 'get');

exports.prototype.hasKey = function(field, callback) {
  this.redis().hexists(this.key, field, callback);
};
aliasMethod('include', 'hasKey');
aliasMethod('isKey', 'hasKey');
aliasMethod('isMember', 'hasKey');
aliasMethod('contains', 'hasKey');

exports.prototype.delete = function(field, callback) {
  this.redis().hdel(this.key, field, callback);
};

exports.prototype.keys = function(callback) {
  this.redis().hkeys(this.key, callback);
};

exports.prototype.values = function(callback) {
  this.redis().hvals(this.key, callback);
};
aliasMethod('vals', 'values');

exports.prototype.all = function(callback) {
  var self = this;
  this.redis().hgetall(this.key, function(e, res) {
    if (e) return callback(e);

    res = res || {};
    for (var key in res) {
      res[key] = self.fromRedis(res[key], self.options.marshalKeys[key]);
    }
    callback(e, res);
  });
};

exports.prototype.size = function(callback) {
  this.redis().hlen(this.key, callback);
};
aliasMethod('length', 'size');
aliasMethod('count', 'size');

exports.prototype.empty = function(callback) {
  this.size(function(e, size) {
    if (e) return callback(e);
    callback(e, size === 0);
  });
};
aliasMethod('isEmpty', 'empty');


/**
 * Set keys in bulk, takes a hash of field/values {'field1' => 'val1'}.
 *
 * Redis: HMSET
 */
exports.prototype.bulkSet = function(values, callback /* = null */) {
  var args = [this.key];
  for (var k in values) {
    args.push(k, this.toRedis(values[k], this.options.marshalKeys[k]));
  }
  if (callback) args.push(callback);
  var redis = this.redis();
  redis.hmset.apply(redis, args);
};
aliasMethod('update', 'bulkSet');

/**
 * Set keys in bulk if they do not exist. Takes a hash of field/values {'field1'
 * => 'val1'}.
 *
 * Redis: HSETNX
 */
exports.prototype.fill = function(values, callback /* = null */) {
  var args = [this.key];
  for (var k in values) {
    args.push(k, this.toRedis(values[k], this.options.marshalKeys[k]));
  }
  if (callback) args.push(callback);

  var redis = this.redis();
  redis.hmset.apply(redis, args);
};

/**
 * Get keys in bulk, takes an array of fields as arguments and returns an object mapping key to value.
 *
 * Redis: HMGET
 */
exports.prototype.bulkGet = function(fields, callback) {
  var self = this;
  this.redis().hmget(this.key, fields, function(e, values) {
    if (e) return callback(e);
    var hash = {};
    for (var i = 0; i < fields.length; i++) {
      hash[fields[i]] = self.fromRedis(values[i], self.options.marshalKeys[fields[i]]);
    }
    callback(e, hash);
  });
};

/**
 * Get values in bulk, takes an array of keys as arguments. Values are returned
 * in an array in the same order that their keys are specified.
 *
 *  Redis: HMGET
 */
exports.prototype.bulkValues = function(fields, callback) {
  this.redis().hmget(this.key, fields, callback);
};

exports.prototype.incrby = function(field, val, callback) {
  if (_.isFunction(val)) callback = val;
  if (!_.isNumber(val)) val = 1;
  this.redis().hincrby(this.key, field, val, callback);
};
aliasMethod('incr', 'incrby');
