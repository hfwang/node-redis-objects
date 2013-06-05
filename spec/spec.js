var _ = require('underscore');
var async = require('async');
var should = require('should');
var child_process = require('child_process');
var redis = require('redis')

var redisProcess = null;
var client = null;

before(function(done) {
  redisProcess = child_process.exec(
    'redis-server redis.conf',
    { cwd: __dirname },
    function (error, stdout, stderr) {
      console.log('stdout: ' + stdout);
      console.log('stderr: ' + stderr);
      if (error !== null) {
        console.log('exec error: ' + error);
      }

    });
  client = redis.createClient(2229, 'localhost', {});
  client.once('connect', function() {
    // Use a normally unavailable database
    client.select(31, function(err, res) {
      client.flushdb(function(err, res) {
        done();
      });
    });
  });
  client.once('error', function(error) {
    if (/ECONNREFUSED$/.test(error.toString())) {
      // Ignore: the server isn't up yet.
    } else {
      throw error;
    }
  })
})

describe("node_redis works", function() {
  it("should connect", function(done) {
    async.series([
      function(callback) {
        client.keys('*', function(err, res) {
          res.length.should == 0;
          callback();
        });
      },
      function(callback) {
        client.set('foo', 'bar', callback);
      },
      function(callback) {
        client.keys('*', function(err, res) {
          res.length.should == 1;
          callback();
        });
      }], done);
  });
});

process.on('exit', function() {
  if (redisProcess) {
    redisProcess.kill();
  }
});
