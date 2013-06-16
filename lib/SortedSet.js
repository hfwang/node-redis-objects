var _ = require('underscore');
var BaseObject = require('./BaseObject');
var aliasMethod = require('./util').aliasMethod.bind(undefined, SortedSet);

/**
 * Creates a handle to a redis sorted set.
 *
 * @constructor
 */
function SortedSet(key, myRedis, options) {
  BaseObject.apply(this, arguments);
}
module.exports = exports = SortedSet;

exports.prototype = Object.create(BaseObject.prototype);
exports.prototype.constructor = exports;


/**
 * Add a member and its corresponding value to Redis. Note that the arguments
 * to this are flipped; the member comes first rather than the score.
 *
 * Redis: ZADD
 */
SortedSet.prototype.add = function(member, score, callback) {
  this.redis().zadd(this.key, score, this.toRedis(member), callback);
};
aliasMethod('put', 'add');
aliasMethod('set', 'add');

/**
 * Add multiple member and its corresponding value to Redis. Note that the
 * arguments to this are flipped; the member comes first rather than the score,
 *
 * Redis: ZADD
 */
SortedSet.prototype.addAll = function(values, callback) {
  var self = this, args = [this.key];
  if (_.isArray(values)) {
    _.each(values, function(pair) {
      var k = pair[0], v = pair[1];
      args.push(v, self.toRedis(k));
    });
  } else {
    _.each(values, function(v, k) {
      args.push(v, self.toRedis(k));
    });
  }

  this.redis().zadd(args, callback);
};
aliasMethod('putAll', 'addAll');
aliasMethod('setAll', 'addAll');

/**
 * Return the score of the specified element of the sorted set at key. If the
 * specified element does not exist in the sorted set, or the key does not exist
 * at all, null is returned.
 *
 * Redis: ZSCORE.
 */
SortedSet.prototype.score = function(member, callback) {
  this.redis().zscore(this.key, this.toRedis(member), function(e, res) {
    if (e) return callback(e);

    callback(e, parseFloat(res));
  });
};

/**
 * Return the rank of the member in the sorted set, with scores ordered from low
 * to high. When the given member does not exist in the sorted set, nil is
 * returned. The returned rank (or index) of the member is 0-based.
 *
 * Redis: ZRANK
 */
SortedSet.prototype.rank = function(member, callback) {
  this.redis().zrank(this.key, this.toRedis(member), callback);
};

/**
 * Return the rank of the member in the sorted set, with scores ordered from
 * high to low.  When the given member does not exist in the sorted set, nil is
 * returned. The returned rank (or index) of the member is 0-based.
 *
 * Redis: ZREVRANK
 */
SortedSet.prototype.revrank = function(member, callback) {
  this.redis().zrevrank(this.key, this.toRedis(member), callback);
};
aliasMethod('revRank', 'revrank');

/**
 * Return all members of the sorted set, set options to {withScores: true} to
 * include scores.
 */
SortedSet.prototype.members = function(options, callback) {
  if (_.isFunction(options)) {
    callback = options;
    options = {};
  }

  this.range(0, options, callback);
};

/**
 * The number of members within a range of scores.
 *
 * Redis: ZCOUNT
 */
SortedSet.prototype.rangeSize = function(min, max, callback) {
  this.redis().zcount(this.key, min, max, callback);
};

var maybeParseScorePairs = function(self, callback, withScores) {
  if (withScores) {
    return function(e, res) {
      if (e) return callback(e);

      var pairs = [];
      for (var i = 0, l = res.length; i < l; i += 2) {
        pairs.push([self.fromRedis(res[i]), parseFloat(res[i + 1])]);
      }
      callback(e, pairs);
    };
  } else {
    return self.makeArrayCallback(callback);
  }
};

var baseRange = function baseRange(command, index, end, options, callback) {
  var withScores;

  if (!_.isNumber(end)) {
    callback = options;
    options = end;
    end = undefined;
  }
  if (_.isFunction(options)) {
    callback = options;
    options = null;
  }
  if (!options) options = {};
  withScores = options.withScores || options.withscores;

  var args = [this.key, index, _.isNumber(end) ? end - 1 : -1];
  if (withScores) args.push('WITHSCORES');
  this.redis()[command](args, maybeParseScorePairs(this, callback, withScores));
};

/**
 * Return a range of values from start index to end index. Returns an array of
 * values, or if options is set to {withScores: true}, an array of [score,
 * value] pairs.
 *
 * Redis: ZRANGE
 */
SortedSet.prototype.range = _.partial(baseRange, 'zrange');
aliasMethod('slice', 'range');

/**
 * Return a range of values from +start_index+ to +end_index+ in reverse
 * order.
 *
 * Redis: ZREVRANGE
 */
SortedSet.prototype.revrange = _.partial(baseRange, 'zrevrange');
aliasMethod('revRange', 'revrange');

var baseRangeByScore = function(command, min, max, options, callback) {
  if (_.isFunction(options)) {
    callback = options;
    options = {};
  }
  options = options || {};
  if ('limit' in options) options.count = options.limit;

  var args = [this.key, min, max];
  var withScores = options.withscores || options.withScores;
  if (withScores) {
    args.push('WITHSCORES');
  }
  if ('offset' in options || 'count' in options) {
    args.push('LIMIT', options.offset || 0, options.count || -1);
  }

  this.redis()[command](args, maybeParseScorePairs(this, callback, withScores));
};

/**
 * Return all the elements in the sorted set at key with a score between min and
 * max ordered from high to low. By default the bounds are inclusive, however,
 * if the score is prefixed with an open paren, that bound is then exclusive.
 *
 * Options:
 * count, offset - passed to LIMIT
 * withscores    - if true, scores are returned as well
 *
 * Redis: ZRANGEBYSCORE
 */
SortedSet.prototype.rangebyscore = _.partial(baseRangeByScore, 'zrangebyscore');
aliasMethod('rangeByScore', 'rangebyscore');

/**
 * Return all the elements in the sorted set at key with a score between min and
 * max ordered from low to high. By default the bounds are inclusive, however,
 * if the score is prefixed with an open paren, that bound is then exclusive.
 *
 * Options:
 * count, offset - passed to LIMIT
 * withscores    - if true, scores are returned as well
 *
 * Redis: ZREVRANGEBYSCORE
 */
SortedSet.prototype.revrangebyscore = _.partial(baseRangeByScore, 'zrevrangebyscore');
aliasMethod('revRangeByScore', 'revRangeByScore');

/**
 * Remove all elements in the sorted set at key with rank between start and
 * end. Start and end are 0-based with rank 0 being the element with the lowest
 * score. Both start and end can be negative numbers, where they indicate
 * offsets starting at the element with the highest rank. For example: -1 is the
 * element with the highest score, -2 the element with the second highest score
 * and so forth.
 *
 * Redis: ZREMRANGEBYRANK
 */
SortedSet.prototype.remrangebyrank = function(min, max, callback) {
  this.redis().zremrangebyrank(this.key, min, max, callback);
};
aliasMethod('remRangeByRank', 'remrangebyrank');

/**
 * Remove all the elements in the sorted set at key with a score between min and
 * max (including elements with score equal to min or max).
 *
 * Redis: ZREMRANGEBYSCORE
 */
SortedSet.prototype.remrangebyscore = function(min, max, callback) {
  this.redis().zremrangebyscore(this.key, min, max, callback);
};
aliasMethod('remRangeByScore', 'remrangebyscore');


/**
 * Delete the value from the set.
 *
 * Redis: ZREM
 */
SortedSet.prototype.delete = function(value, callback) {
  this.redis().zrem(this.key, this.toRedis(value), this.makeCallback(callback));
};

/**
 # Increment the rank of that member atomically and return the new value. This
 # method is aliased as incr() for brevity.
 *
 * Redis: ZINCRBY
 */
SortedSet.prototype.increment = function(member, by, callback) {
  if (!_.isNumber(by)) {
    callback = by;
    by = 1;
  }
  this.redis().zincrby(this.key, by, this.toRedis(member), this.makeCallback(callback, Number));
};
aliasMethod('incr', 'increment');
aliasMethod('incrby', 'increment');

/** Convenience to calling increment() with a negative number. */
SortedSet.prototype.decrement = function(member, by, callback) {
  if(!_.isNumber(by)) {
    callback = by;
    by = 1;
  }
  this.increment(member, -1 * by, callback);
};
aliasMethod('decr', 'decrement');
aliasMethod('decrby', 'decrement');

/** Return the value at the given index. */
SortedSet.prototype.at = function(index, callback) {
  this.range(index, index + 1, function(e, res) {
    if (e) return callback(e);
    callback(e, res[0]);
  });
};

/** Return the first element in the list. */
SortedSet.prototype.first = function(callback) {
  this.at(0, callback);
};

/** Return the last element in the list. */
SortedSet.prototype.last = function(callback) {
  this.at(-1, callback);
};

/**
 * The number of members in the set. Aliased as size
 *
 * Redis: ZCARD
 */
SortedSet.prototype.length = function(callback) {
  this.redis().zcard(this.key, callback);
};
aliasMethod('size', 'length');

/**
 * Returns true if the set has no members.
 *
 * Redis: ZCARD == 0
 */
SortedSet.prototype.empty = function(callback) {
  this.redis().zcard(this.key, function(e, count) {
    if (e) return callback(e);
    callback(e, count === 0);
  });
};
aliasMethod('isEmpty', 'empty');

SortedSet.prototype.member = function(value, callback) {
  this.redis().zrank(this.key, this.toRedis(value), function(e, res) {
    if (e) return callback(e);
    callback(e, _.isNumber(res));
  });
};
aliasMethod('include', 'member');
aliasMethod('isMember', 'member');
aliasMethod('contains', 'member');
