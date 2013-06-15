var _ = require('underscore');
var BaseObject = require('./BaseObject');
var aliasMethod = require('./util').aliasMethod.bind(undefined, List);

/**
 * Options:
 * maxLength: List will be trimmed on push, unshift and insert
 */
function List(key, myRedis, options) {
  BaseObject.apply(this, arguments);
}
module.exports = exports = List;

exports.prototype = Object.create(BaseObject.prototype);
exports.prototype.constructor = exports;

exports.prototype.maybeTrimCallback = function(callback) {
  var self = this;
  return function(e, res) {
    if (e) {
      callback(e);
    } else if (self.options.maxLength) {
      self.redis().ltrim(self.key, -1 * self.options.maxLength, -1, function(e, r) {
        callback(e, res);
      });
    } else {
      callback(e, res);
    }
  };
};

/**
 * Add a member before or after pivot in the list.
 *
 * Redis: LINSERT
 */
exports.prototype.insert = function(where, pivot, value, callback) {
  this.redis().linsert(
      this.key,
      where,
      this.toRedis(pivot),
      this.toRedis(value),
      this.maybeTrimCallback(callback));
};

/**
 * Add a member to the end of the list.
 *
 * Redis: RPUSH
 */
exports.prototype.push = function(value, callback) {
  this.redis().rpush(
      this.key, this.toRedis(value),
    this.maybeTrimCallback(callback));
};

/**
 * Add multiple members to the end of the list.
 *
 * Redis: RPUSH
 */
exports.prototype.pushAll = function(values, callback) {
  var args = this.allToRedis(values);
  args.unshift(this.key);
  this.redis().rpush(
      args,
      this.maybeTrimCallback(callback));
};
aliasMethod('pushall', 'pushAll');

/**
 * Remove a member from the end of the list.
 *
 * Redis: RPOP
 */
exports.prototype.pop = function(callback) {
  this.redis().rpop(this.key, this.makeCallback(callback));
};

/**
 * Add a member to the start of the list.
 *
 * Redis: LPUSH
 */
exports.prototype.unshift = function(value, callback) {
  this.redis().lpush(
      this.key, this.toRedis(value), this.maybeTrimCallback(callback));
};

/**
 * Add multiple members to the end of the list.
 *
 * Redis: LPUSH
 */
exports.prototype.unshiftAll = function(values, callback) {
  var args = this.allToRedis(values);
  args.unshift(this.key);
  this.redis().lpush(
      args, this.maybeTrimCallback(callback));
};
aliasMethod('unshiftall', 'unshiftAll');

/**
 * Remove a member from the start of the list.
 *
 * Redis: LPOP
 */
exports.prototype.shift = function(callback) {
  this.redis().lpop(this.key, this.makeCallback(callback));
};

/**
 * Return all values in the list.
 *
 * Redis: LRANGE(0,-1)
 */
exports.prototype.values = function(callback) {
  this.range(0, callback);
};

/**
 * Return a range of values from start index to end index. Javascript slices are
 * end-exclusive, so .slice(0, -1) will return all but the last entry. If end is
 * unspecified, reads all the way to the end.
 *
 * Redis: LRANGE
 */
exports.prototype.slice = function baseRange(index, end, callback) {
  if (!_.isNumber(end)) {
    callback = end;
    end = undefined;
  }

  var args = [this.key, index, _.isNumber(end) ? end - 1 : -1];

  this.redis().lrange(args, this.makeArrayCallback(callback));
};
aliasMethod('range', 'slice');

/**
 * Delete the element(s) from the list that match name. If count is specified,
 * only the first-N (if positive) or last-N (if negative) will be removed. Use
 * .del to completely delete the entire key.
 *
 * Redis: LREM
 */
exports.prototype.delete = function(value, count, callback) {
  if (_.isFunction(count)) {
    callback = count;
    count = 0;
  }

  this.redis().lrem(this.key, count, this.toRedis(value), callback);
};

/**
 * Sets the list element at index to value.
 *
 * Redis: LSET
 */
exports.prototype.setAt = function(index, value, callback) {
  this.redis().lset(
      this.key, index, this.toRedis(value), this.makeCallback(callback));
};
aliasMethod('setat', 'setAt');

/**
 * Return the value at the given index.
 *
 * Redis: LINDEX
 */
exports.prototype.at = function(index, callback) {
  this.redis().lindex(this.key, index, this.makeCallback(callback));
};

/**
 * Return the first value in the list
 *
 * Redis: LINDEX(0)
 */
exports.prototype.first = function(callback) {
  this.at(0, callback);
};

/**
 * Return the last value in the list
 *
 * Redis: LINDEX(-1)
 */
exports.prototype.last = function(callback) {
  this.at(-1, callback);
};

/**
 * Return the length of the list.
 *
 * Redis: LLEN
 */
exports.prototype.length = function(callback) {
  this.redis().llen(this.key, callback);
};
aliasMethod('size', 'length');

/**
 * Returns true if the list has no values.
 *
 * Redis: LLEN == 0
 */
exports.prototype.empty = function(callback) {
  this.redis().scard(this.key, function(e, count) {
    if (e) return callback(e);
    callback(e, count === 0);
  });
};
aliasMethod('isEmpty', 'empty');
