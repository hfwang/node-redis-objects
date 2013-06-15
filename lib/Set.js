var _ = require('underscore');
var BaseObject = require('./BaseObject');
var aliasMethod = require('./util').aliasMethod.bind(undefined, Set);

function Set(key, myRedis, options) {
  BaseObject.apply(this, arguments);
}
module.exports = exports = Set;

exports.prototype = Object.create(BaseObject.prototype);
exports.prototype.constructor = exports;

/**
 * Add the specified value to the set only if it does not exist already.
 *
 * Redis: SADD
 */
exports.prototype.add = function(value, callback) {
  this.redis().sadd(this.key, this.toRedis(value), callback);
};
aliasMethod('push', 'add');

/**
 * Remove and return a random member.
 *
 * Redis: SPOP
 */
exports.prototype.pop = function(callback) {
  this.redis().spop(this.key, this.makeCallback(callback));
};

/**
 * Adds the specified values to the set. Only works on redis > 2.4
 *
 * Redis: SADD
 */
exports.prototype.merge = function(values, callback) {
  var self = this, args = [this.key];
  for (var i = 0; i < values.length; i ++) args.push(this.toRedis(values[i]));
  this.redis().sadd(args, callback);
};

/**
 * Returns all members in the set.
 *
 * Redis: SMEMBERS
 */
exports.prototype.members = function(callback) {
  this.redis().smembers(this.key, this.makeArrayCallback(callback));
};

/**
 * Returns true if the specified value is in the set.
 *
 * Redis: SISMEMBER
 */
exports.prototype.isMember = function(value, callback) {
  this.redis().sismember(this.key, this.toRedis(value), callback);
};
aliasMethod('ismember', 'isMember');
aliasMethod('include', 'isMember');
aliasMethod('contains', 'isMember');

/**
 * Delete the value from the set.
 *
 * Redis: SREM
 */
exports.prototype.delete = function(value, callback) {
  this.redis().srem(this.key, this.toRedis(value), callback);
};

/**
 * The number of members in the set.
 *
 * Redis: SCARD
 */
exports.prototype.length = function(callback) {
  this.redis().scard(this.key, callback);
};
aliasMethod('size', 'length');
aliasMethod('count', 'length');

/**
 * Returns true if the set has no members.
 *
 * Redis: SCARD == 0
 */
exports.prototype.empty = function(callback) {
  this.redis().scard(this.key, function(e, count) {
    if (e) return callback(e);
    callback(e, count === 0);
  });
};
aliasMethod('isEmpty', 'empty');
