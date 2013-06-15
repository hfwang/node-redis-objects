var _ = require('underscore');
var BaseObject = require('./BaseObject');
var aliasMethod = require('./util').aliasMethod.bind(undefined, Hash);

function Hash(key, myRedis, options) {
  BaseObject.apply(this, arguments);

  if (!this.options.marshalKeys) {
    this.options.marshalKeys = {};
  }

  if (!this.options.keyMarshaller) {
    this.options.keyMarshaller = String;
  }
}
module.exports = exports = Hash;


exports.prototype = Object.create(BaseObject.prototype);
exports.prototype.constructor = exports;

/**
 * Sets a field to a value.
 *
 * Redis: HSET
 */
exports.prototype.set = function(field, value, callback) {
  this.redis().hset(
      this.key,
      this.toRedis(field, this.options.keyMarshaller),
      this.toRedis(value, this.options.marshalKeys[field]),
      callback);
};
aliasMethod('put', 'set');
aliasMethod('store', 'set');

/**
 * Gets a field.
 *
 * Redis: HGET
 */
exports.prototype.get = function(field, callback) {
  this.redis().hget(
    this.key,
    this.toRedis(field, this.options.keyMarshaller),
    this.makeCallback(callback, this.options.marshalKeys[field]));
};
aliasMethod('fetch', 'get');

/**
 * Verify that a field exists
 *
 * Redis: HEXISTS
 */
exports.prototype.hasKey = function(field, callback) {
  this.redis().hexists(
      this.key,
      this.toRedis(field, this.options.keyMarshaller),
      callback);
};
aliasMethod('include', 'hasKey');
aliasMethod('isKey', 'hasKey');
aliasMethod('isMember', 'hasKey');
aliasMethod('contains', 'hasKey');

/**
 * Delete a field.
 *
 * Redis: HDEL
 */
exports.prototype.delete = function(field, callback) {
  this.redis().hdel(
      this.key,
      this.toRedis(field, this.options.keyMarshaller),
      callback);
};

/**
 * Returns all the keys of the hash.
 *
 * Redis: HKEYS
 */
exports.prototype.keys = function(callback) {
  this.redis().hkeys(this.key, this.makeCallback(callback, this.options.keyMarshaller));
};

/**
 * Returns all the values of the hash. Since the keys are not returned, this
 * uses the default parser. Use #all/#bulkGet/#bulkValues if you are using
 * specific types.
 *
 * Redis: HVALS
 */
exports.prototype.values = function(callback) {
  this.redis().hvals(this.key, this.makeCallback(callback));
};
aliasMethod('vals', 'values');

/**
 * Returns all values of the hash. Since Javascript objects use string keys, the
 * key is kept as a string and not parsed.
 *
 * Redis: HGETALL
 */
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

/**
 * Returns the size of the hash.
 *
 * Redis: HLEN
 */
exports.prototype.size = function(callback) {
  this.redis().hlen(this.key, callback);
};
aliasMethod('length', 'size');
aliasMethod('count', 'size');

/**
 * Calls the callback with true if the hash is empty.
 */
exports.prototype.empty = function(callback) {
  this.size(function(e, size) {
    if (e) return callback(e);
    callback(e, size === 0);
  });
};
aliasMethod('isEmpty', 'empty');


/**
 * Set keys in bulk, takes a hash of field/values {'field1' => 'val1'}, or an
 * array of [key, value] pairs.
 *
 * Redis: HMSET
 */
exports.prototype.bulkSet = function(values, callback /* = null */) {
  var self = this, args = [this.key];
  _.each(values, function(v, k) {
    args.push(
        self.toRedis(k, self.options.keyMarshaller),
        self.toRedis(v, self.options.marshalKeys[k]));
  });
  if (callback) args.push(callback);

  var redis = this.redis();
  redis.hmset.apply(redis, args);
};
aliasMethod('update', 'bulkSet');

/**
 * Set keys in bulk if they do not exist. Takes a hash of field/values {'field1'
 * => 'val1'}, or an array of [key, value] pairs.
 *
 * Redis: HSETNX
 */
exports.prototype.fill = function(values, callback /* = null */) {
  var self = this, args = [this.key];
  _.each(values, function(v, k) {
    args.push(
        self.toRedis(k, self.options.keyMarshaller),
        self.toRedis(v, self.options.marshalKeys[k]));
  });
  if (callback) args.push(callback);

  var redis = this.redis();
  redis.hmset.apply(redis, args);
};

/**
 * Get keys in bulk, takes an array of fields as arguments and returns an object
 * mapping key to value.
 *
 * Note, this does not unmarshal the field value, as Javascript objects only
 * allow string keys.
 *
 * Redis: HMGET
 */
exports.prototype.bulkGet = function(fields, callback) {
  var self = this;
  this.redis().hmget(
      this.key,
      _.map(fields, function(k) { return self.toRedis(k, self.options.keyMarshaller); }),
      function(e, values) {
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
  var self = this;
  this.redis().hmget(
      this.key,
      _.map(fields, function(k) { return self.toRedis(k, self.options.keyMarshaller); }),
      function(e, res) {
        if (e) return callback(e);

        callback(e, _.map(res, function(val, i) {
          return self.fromRedis(val, self.options.marshalKeys[fields[i]]);
        }));
      });
};

exports.prototype.incrby = function(field, val, callback) {
  if (_.isFunction(val)) callback = val;
  if (!_.isNumber(val)) val = 1;
  this.redis().hincrby(this.key, field, val, callback);
};
aliasMethod('incr', 'incrby');
