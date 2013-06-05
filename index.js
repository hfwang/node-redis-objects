var redis = require('redis');

module.exports = exports = function RedisObjects() {
  throw new Error("Figure this out later!");
};

var privateConnection;
exports.connect = function(connection) {
  if (connection) {
    privateConnection = connection;
  }
  return privateConnection;
};
exports.BaseObject = require('./lib/BaseObject');
exports.Value = require('./lib/Value');
