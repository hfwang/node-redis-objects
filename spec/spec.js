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

describe('Value stores single values', function() {
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

process.on('exit', function() {
  if (redisProcess) {
    redisProcess.kill();
  }
});
