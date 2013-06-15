/* jshint expr: true */

var redis_objects = require('../index');
var _ = require('underscore');
var async = require('async');
var should = require('should');
var child_process = require('child_process');
var redis = require('redis');
var assert = require("assert");

var redisProcess = null;
var client = null;

function shouldBeOk(cb) {
  return function(e, res) {
    res.should.be.ok;
    cb(e, res);
  };
}

function shouldNotBeOk(cb) {
  return function(e, res) {
    res.should.not.be.ok;
    cb(e, res);
  };
}

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

afterEach(function() {
  if (client) {
    client.quit();
    client = null;
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
  it('should read and write simple values', function(done) {
    var key = new redis_objects.SortedSet('testKey');
    async.series([
      function(callback) {
        key.put('foo', 1, function(e, res) {
          res.should.equal(1);
          callback(e, res);
        });
      }, function(callback) {
        key.put('foo', 2, function(e, res) {
          res.should.equal(0);
          callback(e, res);
        });
      }, function(callback) {
        key.incr('bar', 4, function(e, res) {
          res.should.equal(4);
          callback(e, res);
        });
      }, function(callback) {
        key.revRange(0, 1, function(e, res) {
          res.should.eql(['bar']);
          callback(e, res);
        });
      }, function(callback) {
        key.range(0, 1, {withScores: true}, function(e, res) {
          res.should.eql([['foo', 2]]);
          callback(e, res);
        });
      }, function(callback) {
        key.score('foo', function(e, res) {
          res.should.equal(2);
          callback(e, res);
        });
      }, function(callback) {
        key.rank('foo', function(e, res) {
          res.should.equal(0);
          callback(e, res);
        });
      }, function(callback) {
        key.revrank('foo', function(e, res) {
          res.should.equal(1);
          callback(e, res);
        });
      }, function(callback) {
        key.delete('foo', callback);
      }, function(callback) {
        key.length(function(e, res) {
          res.should.equal(1);
          callback(e, res);
        });
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
        key.empty(shouldBeOk(cb));
      }, function(cb) {
        key.add('a', cb);
      }, function(cb) {
        key.isMember('a', shouldBeOk(cb));
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

process.on('exit', function() {
  if (redisProcess) {
    redisProcess.kill();
  }
});
