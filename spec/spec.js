/* jshint expr: true */

require('longjohn');
var redis_objects = require('../index');
var _ = require('underscore');
var async = require('async');
var should = require('should');
var child_process = require('child_process');
var redis = require('redis');
var assert = require("assert");

var redisProcess = null;
var client = null;

_.each({
  shouldBeOk: function() {
    var cb = this, error = new Error();

    return function(e, res) {
      try {
        res.should.be.ok;
        cb(e, res);
      } catch(err) {
        error.message = err.message;
        throw error;
      }
    };
  },

  shouldNotBeOk: function() {
    var cb = this, error = new Error();

    return function(e, res) {
      try {
        res.should.not.be.ok;
        cb(e, res);
      } catch(err) {
        error.message = err.message;
        throw error;
      }
    };
  }
}, function(getter, key) {
  Object.defineProperty(Function.prototype, key, { get: getter });
});

_.each({
  shouldEql: function(val) {
    var cb = this, error = new Error();

    return function(e, res) {
      try {
        res.should.eql(val);
        cb(e, res);
      } catch(err) {
        error.message = err.message;
        throw error;
      }
    };
  },
  shouldEqual: function(val) {
    var cb = this, error = new Error();

    return function(e, res) {
      try {
        res.should.equal(val);
        cb(e, res);
      } catch(err) {
        error.message = err.message;
        throw error;
      }
    };
  },
}, function(value, key) {
  Object.defineProperty(Function.prototype, key, { value: value });
});

// This is a wacky marshaller which produces a string representation quite
// different from the number's toString
var wackyMarshaller = {
  parse: function(str) {
    return parseInt(str, 10) - 1;
  },
  stringify: function(num) {
    return (num + 1).toString();
  }
};

before(function() {
  redisProcess = child_process.exec(
    'redis-server redis.conf',
    { cwd: __dirname },
    function (error, stdout, stderr) {
      console.log('stdout: ' + stdout);
      console.log('stderr: ' + stderr);
      if (error !== null) {
        console.log('exec error: ' + error);
        throw error;
      }
    });
});

beforeEach(function(done) {
  client = redis.createClient(2229, 'localhost', {});

  var errorHandler = function(error) {
    if (/ECONNREFUSED$/.test(error.toString())) {
      // Ignore: the server isn't up yet.
    } else {
      throw error;
    }
  };
  client.on('error', errorHandler);

  var checkReady = function() {
    if (client.ready) {
      client.removeListener('error', errorHandler);
      // Use a normally unavailable database in an effort to avoid stomping on
      // people's real redis DBs.
      client.select(31, function(err, res) {
        client.flushdb(function(err, res) {
          redis_objects.connect(client);
          done();
        });
      });
    } else {
      setImmediate(checkReady);
    }
  };
  checkReady();
});

afterEach(function(done) {
  if (client) {
    async.series([
      client.flushdb.bind(client),
      client.quit.bind(client),
      function(cb) {
        client = null;
        cb(undefined);
      }
    ], done);
  }
});

describe('node_redis works (smoke test)', function() {
  it('should connect', function(done) {
    async.series([
      function(callback) {
        client.keys('*', function(err, res) {
          res.length.should.equal(0);
          callback();
        });
      },
      function(callback) {
        client.set('foo', 'bar', callback);
      },
      function(callback) {
        client.keys('*', function(err, res) {
          res.length.should.equal(1);
          callback();
        });
      }], done);
  });
});

describe('Value', function() {
  it('should read and write simple values', function(done) {
    var simpleValue = new redis_objects.Value('testKey');
    async.series([
      function(callback) {
        simpleValue.getValue(function(e, res) {
          assert.equal(res, undefined);
          callback(e, res);
        });
      },
      function(callback) {
        simpleValue.setValue('NEW VALUE HERE', callback);
      },
      function(callback) {
        simpleValue.getValue(function(e, res) {
          res.should.equal('NEW VALUE HERE');
          callback(e, res);
        });
      }
    ], done);
  });

  it('should read and write simple values as strings', function(done) {
    var simpleValue = new redis_objects.Value('testKey');
    async.series([
      function(callback) {
        simpleValue.setValue(1, callback);
      },
      function(callback) {
        simpleValue.getValue(function(e, res) {
          res.should.equal('1');
          callback(e, res);
        });
      }
    ], done);
  });

  it('should support default values', function(done) {
    var simpleValue, simpleValue2;
    async.series([
      function(cb) {
        client.set('testKey2', 'blah', cb());
      },
      function(cb) {
        simpleValue = new redis_objects.Value('testKey', {default: 'bah'});
        simpleValue2 = new redis_objects.Value('testKey2', {default: 'bah'});
        cb();
      },
      function(cb) {
        simpleValue.getValue(function(e, r) {
          // Should use default value
          r.should.eql('bah');
          cb(e, r);
        });
      },
      function (cb) {
        simpleValue2.getValue(function(e, r) {
          // Should use previously set value
          r.should.eql('blah');
          cb(e, r);
        });
      }
    ], done);
  });

  describe('marshalling', function() {
    it('should marshal and unmarshal from JSON', function(done) {
      var simpleValue = new redis_objects.Value('testKey', {marshal: true});
      async.series([
        function(callback) {
          simpleValue.setValue({foo: 'bar', bar: 1}, callback);
        },
        function(callback) {
          simpleValue.getValue(function(e, res) {
            res.should.eql({foo: 'bar', bar: 1});
            callback(e, res);
          });
        }
      ], done);
    });

    it('should support custom marshallers', function(done) {
      var marshaller = {
        stringify: function(val) {
          return "1" + JSON.stringify(val)+ "2";
        },
        parse: function(val) {
          return JSON.parse(val.slice(1, -1));
        }
      };
      var simpleValue = new redis_objects.Value('testKey', {marshal: marshaller});
      async.series([
        function(callback) {
          simpleValue.getValue(function(e, res) {
            should.not.exist(res);
            callback(e, res);
          });
        },
        function(callback) {
          simpleValue.setValue({foo: 'bar', bar: 1}, callback);
        },
        function(callback) {
          simpleValue.getValue(function(e, res) {
            res.should.eql({foo: 'bar', bar: 1});
            callback(e, res);
          });
        }
      ], done);
    });
  });

  describe('BaseObject-based behaviour', function() {
    it('can inspect', function() {
      var value = new redis_objects.Value('testKey');
      value.inspect().should.equal('#<Value key: testKey>');
    });

    it('basic existance checks', function(done) {
      var value = new redis_objects.Value('testKey');

      async.series([
        function(cb) {
          value.type(function(e, res) {
            res.should.equal('none');
            cb(e, res);
          });
        }, function(cb) {
          value.exists(cb.shouldNotBeOk);
        }, function(cb) {
          value.set('foo', cb);
        }, function(cb) {
          value.exists(cb.shouldBeOk);
        }, function(cb) {
          value.type(cb.shouldEql('string'));
        }, function(cb) {
          value.clear(cb);
        }, function(cb) {
          value.exists(cb.shouldNotBeOk);
        }
      ], done);
    });

    it('key expiry', function(done) {
      var value = new redis_objects.Value('keyForExpiryTest');
      var future = 2524629600; // 2050/01/01 00:00:00
      async.series([
        function(cb) {
          value.set('foo', cb);
        }, function(cb) {
          value.ttl(cb.shouldEql(-1));
        }, function(cb) {
          value.expire(10000, cb);
        }, function(cb) {
          value.expireAt(future, cb.shouldBeOk);
        }, function(cb) {
          // Sometime in the future, this is basically just ensuring its greater
          // than 0
          value.ttl(cb.shouldBeOk);
        }, function(cb) {
          value.persist(cb);
        }, function(cb) {
          value.ttl(cb.shouldEql(-1));
        }
      ], done);
    });

    it('key rename (no exist)', function(done) {
      var value = new redis_objects.Value('key1');
      var existingValue = new redis_objects.Value('keyExists');

      async.series([
        value.set.bind(value, 'a'),
        existingValue.set.bind(existingValue, '123'),
        function(cb) {
          value.renamenx('key2', true, cb.shouldBeOk);
        }, function(cb) {
          value.key.should.eql('key2');
          cb();
        }, function(cb) {
          value.renamenx('keyExists', cb.shouldNotBeOk);
        }, function(cb) {
          value.key.should.eql('key2');
          cb();
        }, function(cb) {
          value.renamenx('key3', false, cb.shouldBeOk);
        }, function(cb) {
          value.key.should.eql('key2');
          value.key = 'key3';
          value.renamenx('key4', cb.shouldBeOk);
        }, function(cb) {
          value.key.should.eql('key4');
          cb();
        }, function(cb) {
          value.renamenx(existingValue, cb.shouldNotBeOk);
        }
      ], done);
    });

    it('key rename', function(done) {
      var value = new redis_objects.Value('key1');
      var existingValue = new redis_objects.Value('keyExists');

      async.series([
        value.set.bind(value, 'a'),
        existingValue.set.bind(existingValue, '123'),
        function(cb) {
          value.rename('key2', true, cb.shouldBeOk);
        }, function(cb) {
          value.key.should.eql('key2');
          cb();
        }, function(cb) {
          value.rename('keyExists', cb.shouldBeOk);
        }, function(cb) {
          value.key.should.eql('keyExists');
          cb();
        }, function(cb) {
          value.rename('key3', false, cb.shouldBeOk);
        }, function(cb) {
          value.key.should.eql('keyExists');
          value.key = 'key3';
          value.rename('key4', cb.shouldBeOk);
        }, function(cb) {
          value.key.should.eql('key4');
          cb();
        }, function(cb) {
          value.rename(existingValue, cb.shouldBeOk);
        }
      ], done);
    });
  });
});

describe('Hash', function() {
  it('should read and write simple values', function(done) {
    var simpleValue = new redis_objects.Hash('testKey');
    async.series([
      function(callback) {
        simpleValue.isEmpty(function(e, res) {
          res.should.be.ok;
          callback(e, res);
        });
      }, function(callback) {
        simpleValue.get('foo', function(e, res) {
          assert.equal(res, undefined);
          callback(e, res);
        });
      }, function(callback) {
        simpleValue.include('foo', function(e, res) {
          res.should.not.be.ok;
          callback(e, res);
        });
      }, function(callback) {
        simpleValue.set('foo', 'NEW VALUE HERE', callback);
      }, function(callback) {
        simpleValue.get('foo', function(e, res) {
          res.should.equal('NEW VALUE HERE');
          callback(e, res);
        });
      }, function(callback) {
        simpleValue.include('foo', function(e, res) {
          res.should.be.ok;
          callback(e, res);
        });
      }, function(callback) {
        simpleValue.fill({foo: 'ANOTHER VALUE', bar: 'ANOTHER VALUE'}, callback);
      }, function(callback) {
        simpleValue.size(function(e, res) {
          res.should.equal(2);
          callback(e, res);
        });
      }, function(callback) {
        simpleValue.bulkSet({foo: 'VALUE', baz: 'FOO'}, callback);
      }, function(callback) {
        simpleValue.bulkGet(['foo', 'bar', 'baz'], function(e, res) {
          res.should.eql({foo: 'VALUE', bar: 'ANOTHER VALUE', baz: 'FOO'});
          callback(e, res);
        });
      }, function(callback) {
        simpleValue.bulkValues(['foo', 'bar', 'baz'], function(e, res) {
          res.should.eql(['VALUE', 'ANOTHER VALUE', 'FOO']);
          callback(e, res);
        });
      }, function(callback) {
        simpleValue.delete('foo', callback);
      }, function(callback) {
        simpleValue.include('foo', function(e, res) {
          res.should.not.be.ok;
          callback(e, res);
        });
      }
    ], done);
  });

  it('should support bulk update and fill with objects', function(done) {
    var hash = new redis_objects.Hash('testKey', {marshal: wackyMarshaller});

    async.series([
      hash.bulkSet.bind(hash, {a: 1, b: 2, c: 3}),
      hash.fill.bind(hash, {c: 1, d: 4, e: 5}),
      function(cb) {
        hash.all(function(e, res) {
          res.should.eql({
            a: 1,
            b: 2,
            c: 3,
            d: 4,
            e: 5
          });
          cb(e, res);
        });
      }
    ], done);
  });

  it('should support bulk update and fill with pairs', function(done) {
    var hash = new redis_objects.Hash('testKey', {marshal: wackyMarshaller});

    async.series([
      hash.bulkSet.bind(hash, [['a', 1], ['b', 2], ['c', 3]]),
      hash.fill.bind(hash, [['c', 1], ['d', 4], ['e', 5]]),
      function(cb) {
        hash.all(function(e, res) {
          res.should.eql({
            a: 1,
            b: 2,
            c: 3,
            d: 4,
            e: 5
          });
          cb(e, res);
        });
      }
    ], done);
  });

  it('should support incrementing', function(done) {
    var hash = new redis_objects.Hash('key', {marshal: 'Integer'});

    async.series([
      function(cb) {
        hash.incr('foo', function(e, res) {
          res.should.equal(1);
          cb(e, res);
        });
      }, function(cb) {
        hash.get('foo', function(e, res) {
          res.should.equal(1);
          cb(e, res);
        });
      }, function(cb) {
        hash.incrby('foo', 200, function(e, res) {
          res.should.equal(201);
          cb(e, res);
        });
      }
    ], done);
  });

  describe('marshalling', function() {
    it('should support marshaling', function(done) {
      var jsonHash = new redis_objects.Hash('testKey', {marshal: true});
      var keyedHash = new redis_objects.Hash('testKey2', {marshalKeys: {a: true, b: Number}});
      async.series([
        function(cb) {
          jsonHash.all(cb.shouldEql({}));
        }, function(cb) {
          jsonHash.store('a', {a: true, b: 1, c: 1}, cb);
        }, function(cb) {
          keyedHash.store('a', {a: true, b: 1, c: 1}, cb);
        }, function(cb) {
          jsonHash.all(function(e, r) {
            r.should.eql({a: {a: true, b: 1, c: 1}});
            cb();
          });
        }, function(cb) {
          keyedHash.all(function(e, r) {
            r.should.eql({a: {a: true, b: 1, c: 1}});
            cb();
          });
        }, function(cb) {
          keyedHash.bulkSet({b: 1, c: 2}, cb);
        }, function(cb) {
          keyedHash.bulkValues(['b', 'c'], function(e, r) {
            r.should.eql([1, '2']);
            cb();
          });
        }, function(cb) {
          keyedHash.bulkGet(['b', 'c'], function(e, r) {
            r.should.eql({b: 1, c: '2'});
            cb();
          });
        }
      ], done);
    });

    it('should handle wackyMarshaller', function(done) {
      var hash = new redis_objects.Hash('testKey', {marshal: wackyMarshaller});

      async.series([
        function(cb) {
          hash.bulkSet([
            ['a', 1],
            ['b', 2],
            ['c', 3]
          ], cb.shouldBeOk);
        }, function(cb) {
          hash.get('a', cb.shouldEql(1));
        }, function(cb) {
          hash.values(function(e, res) {
            res.sort().should.eql([1, 2, 3]);
            cb(e, res);
          });
        }, function(cb) {
          hash.keys(function(e, res) {
            // Keys are not numbers, that's for keyMarshaller.
            res.sort().should.eql(['a', 'b', 'c']);
            cb(e, res);
          });
        }
      ], done);
    });

    it('should support marshalled keys', function(done) {
      var hash = new redis_objects.Hash('testKey', {keyMarshaller: true});

      async.series([
        function(cb) {
          hash.store([1], 'a', cb);
        }, function(cb) {
          hash.get([1], function(e, res) {
            res.should.equal('a');
            cb(e, res);
          });
        }, function(cb) {
          hash.hasKey([1], function(e, res) {
            res.should.equal(1);
            cb(e, res);
          });
        }, function(cb) {
          hash.delete([1], cb);
        }, function(cb) {
          hash.hasKey([1], function(e, res) {
            res.should.equal(0);
            cb(e, res);
          });
        }
      ], done);
    });
  });
});

describe('SortedSet', function() {
  it('should handle missing elements', function(done) {
    var key = new redis_objects.SortedSet('testKey');

    async.series([
      function(cb) {
        key.empty(cb.shouldBeOk);
      },
      function(cb) {
        key.score('foo', function(e, res) {
          should.not.exist(res);
          cb(e, res);
        });
      }
    ], done);
  });

  it('should read and write simple values', function(done) {
    var key = new redis_objects.SortedSet('testKey');
    async.series([
      function(cb) {
        key.empty(cb.shouldBeOk);
      }, function(cb) {
        key.put('foo', 1, cb.shouldEqual(1));
      }, function(cb) {
        key.member('foo', cb.shouldBeOk);
      }, function(cb) {
        key.put('foo', 2, cb.shouldEqual(0));
      }, function(cb) {
        key.incr('bar', 6, cb.shouldEql(6));
      }, function(cb) {
        key.incr('bar', cb.shouldEql(7));
      }, function(cb) {
        key.decr('bar', 2, cb.shouldEql(5));
      }, function(cb) {
        key.decr('bar', cb.shouldEql(4));
      }, function(cb) {
        key.revRange(0, 1, cb.shouldEql(['bar']));
      }, function(cb) {
        key.range(0, 1, {withScores: true}, cb.shouldEql([['foo', 2]]));
      }, function(cb) {
        key.score('foo', cb.shouldEqual(2));
      }, function(cb) {
        key.rank('foo', cb.shouldEqual(0));
      }, function(cb) {
        key.revrank('foo', cb.shouldEqual(1));
      }, function(cb) {
        key.delete('foo', cb);
      }, function(cb) {
        key.length(cb.shouldEqual(1));
      }, function(cb) {
        key.members(cb.shouldEql(['bar']));
      }, function(cb) {
        key.addAll({a : 1, b: 2}, cb);
      }, function(cb) {
        key.addAll([['c', 3], ['e', 5]], cb);
      }, function(cb) {
        key.rangeSize(1, 3, cb.shouldEqual(3));
      }, function(cb) {
        key.rangeByScore(2, 4, cb.shouldEql(['b', 'c', 'bar']));
      }, function(cb) {
        key.rangeByScore(2, 4, {count: 1}, cb.shouldEql(['b']));
      }, function(cb) {
        key.rangeByScore(2, 4, {offset: 1}, cb.shouldEql(['c', 'bar']));
      }, function(cb) {
        key.rangeByScore(2, 4, {limit: 1, offset: 1, withScores: true}, cb.shouldEql([['c', 3]]));
      }, function(cb) {
        key.first(cb.shouldEql('a'));
      }, function(cb) {
        key.last(cb.shouldEql('e'));
      }, function(cb) {
        key.remRangeByRank(-1, -1, cb.shouldEql(1));
      }, function(cb) {
        key.last(cb.shouldEql('bar'));
      }, function(cb) {
        key.remRangeByScore(1, '(4', cb);
      }, function(cb) {
        key.last(cb.shouldEql('bar'));
      }
    ], done);
  });
});

describe('Set', function() {
  it('should read and write simple values', function(done) {
    var key = new redis_objects.Set('testKey');
    async.series([
      function(cb) {
        key.members(function(e, res) {
          res.should.eql([]);
          cb(e, res);
        });
      }, function(cb) {
        key.empty(cb.shouldBeOk);
      }, function(cb) {
        key.add('a', cb);
      }, function(cb) {
        key.isMember('a', cb.shouldBeOk);
      }, function(cb) {
        key.pop(function(e, res) {
          res.should.equal('a');
          cb(e, res);
        });
      }, function(cb) {
        key.merge(['a', 'b', 'c'], cb);
      }, function(cb) {
        key.members(function(e, res) {
          res.sort().should.eql(['a', 'b', 'c']);
          cb(e, res);
        });
      }, function(cb) {
        key.delete('b', function(e, res) {
          res.should.equal(1);
          cb(e, res);
        });
      }, function(cb) {
        key.delete('b', function(e, res) {
          res.should.equal(0);
          cb(e, res);
        });
      }, function(cb) {
        key.length(function(e, res) {
          res.should.equal(2);
          cb(e, res);
        });
      }
    ], done);
  });
});

describe('List', function() {
  it('should read and write simple values', function(done) {
    var key = new redis_objects.List('testKey');

    async.series([
      function(cb) {
        key.empty(cb.shouldBeOk);
      }, function(cb) {
        key.push('c', cb.shouldBeOk);
      }, function(cb) {
        key.insert('BEFORE', 'c', 'b', cb.shouldBeOk);
      }, function(cb) {
        key.values(cb.shouldEql(['b', 'c']));
      }, function(cb) {
        key.range(0, -1, cb.shouldEql(['b']));
      }, function(cb) {
        key.push('d', cb.shouldBeOk);
      }, function(cb) {
        key.unshift('a', cb.shouldBeOk);
      }, function(cb) {
        key.range(0, cb.shouldEql(['a', 'b', 'c', 'd']));
      }, function(cb) {
        key.pop(cb.shouldEqual('d'));
      }, function(cb) {
        key.shift(cb.shouldEqual('a'));
      }, function(cb) {
        key.unshiftAll(['a', 'a', 'a', 'a'], cb.shouldEqual(6));
      }, function(cb) {
        key.delete('a', 2, cb.shouldEqual(2));
      }, function(cb) {
        key.setAt(1, '0', cb.shouldBeOk);
      }, function(cb) {
        key.values(cb.shouldEql(['a', '0', 'b', 'c']));
      }, function(cb) {
        key.first(cb.shouldEqual('a'));
      }, function(cb) {
        key.last(cb.shouldEqual('c'));
      }, function(cb) {
        key.length(cb.shouldEqual(4));
      }, function(cb) {
        key.at(1, cb.shouldEqual('0'));
      }, function(cb) {
        key.pushAll(['d', 'e'], cb);
      }, function(cb) {
        key.values(cb.shouldEql(['a', '0', 'b', 'c', 'd', 'e']));
      }
    ], done);
  });

  it('can be used as a fixed length buffer', function(done) {
    var key = new redis_objects.List('testKey', {maxLength: 3, marshal: wackyMarshaller});

    async.series([
      function(cb) {
        key.push(1, cb);
      }, function(cb) {
        // 4 elements are pushed on, (5 total) and the callback will return the
        // normal result...
        key.unshiftAll([-3, -2, -1, 0].reverse(), cb.shouldEqual(5));
      }, function(cb) {
        // But it will then be trimmed.
        key.values(cb.shouldEql([-1, 0, 1]));
      }, function(cb) {
        key.push(2, cb);
      }, function(cb) {
        key.values(cb.shouldEql([0, 1, 2]));
      }
    ], done);
  });

  it('supports marshaling', function(done) {
    var key = new redis_objects.List('testKey', {marshal: wackyMarshaller});

    async.series([
      key.pushAll.bind(key, [0, 0, 1, 1, 2, 2]),
      key.delete.bind(key, 1),
      function(cb) {
        key.values(cb.shouldEql([0, 0, 2, 2]));
      },
    ], done);
  });
});

process.on('exit', function() {
  if (redisProcess) {
    redisProcess.kill();
  }
});
