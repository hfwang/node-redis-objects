exports.mixin = function mixin(klass) {
  klass.prototype.toRedis = function toRedis(value, marshal /* = null */) {
    if (marshal === undefined) {
      marshal = (this.options || {}).marshal || false;
    }

    return reallyToRedis(value, marshal);
  };

  klass.prototype.fromRedis = function fromRedis(value, marshal /* = null */) {
    if (marshal === undefined) {
      marshal = (this.options || {}).marshal || false;
    }

    return reallyFromRedis(value, marshal);
  };

  // This solely exists to reduce boilerplate.
  klass.prototype.makeCallback = function makeCallback(callback) {
    var self = this;
    return function(err, res) {
      if (res && !err) {
        callback(err, self.fromRedis(res));
      } else {
        callback(err);
      }
    };
  };
};

var reallyToRedis = exports.reallyToRedis = function(value, marshal) {
  if (!marshal) {
    // Assume anything "false-y" is unmarshalled.
    return value;
  } else if (marshal === String || marshal === Number || marshal == 'Integer' || marshal == 'Float') {
    if (value === null) {
      return 'null';
    } else if (value === undefined) {
      return 'undefined';
    } else {
      return value.toString();
    }
  } else if (marshal === true) {
    return JSON.stringify(value);
  } else {
    return marshal.stringify(value);
  }
};

var reallyFromRedis = exports.reallyFromRedis = function(value, marshal) {
  if (!marshal) {
    // Assume anything "false-y" is unmarshalled.
    return value;
  } else if (value === null) {
    // This is a direct port of the redis-objects code, I'm not sure this is
    // reachable
    return null;
  } else if (value instanceof Array) {
    return value.map(function(v) {
      reallyFromRedis(v, marshal);
    });
  } else if (typeof value == 'object') {
    // JS is not great about detecting if something is a hash...
    var result = {};
    for (var key in value) {
      result[key] = reallyFromRedis(value[key], marshal);
    }
    return result;
  } else if (marshal === String) {
    return value;
  } else if (marshal === Number || marshal == 'Float') {
    return parseFloat(value);
  } else if (marshal == 'Integer') {
    return parseInt(value, 10);
  } else if (marshal === true) {
    return JSON.parse(value);
  } else {
    return marshal.parse(value);
  }
};
