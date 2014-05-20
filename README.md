# node-redis-objects

[![NPM Version](http://img.shields.io/npm/v/redis-objects.svg)][npm]
[![Build Status](http://img.shields.io/travis/hfwang/node-redis-objects.svg)][travis]
[![MIT license](http://img.shields.io/badge/license-MIT-red.svg)][license]

[npm]: https://www.npmjs.org/package/redis-objects
[travis]: https://travis-ci.org/hfwang/node-redis-objects
[license]: https://github.com/hfwang/ar_protobuf_store/blob/master/LICENSE.txt

A nodejs reimagining of the [redis-objects ruby gem](https://github.com/nateware/redis-objects),
acting as an object-oriented bridge between redis and node.

This has a number of advantages over working with the `node-redis` api directly.

1. Complex data structures are automatically marshaled (if {marshal: true})
2. Type coercion for things that are numeric
3. Cleans up some warts (sorted set results with scores are returned as a arrays of pairs of [value, score])

## Basic Usage

There is a class that maps to each Redis type, with methods for each
[Redis API command](http://redis.io/commands).

Note that calling `new` does not imply it's actually a "new" value - it just
creates a mapping between that object and the corresponding Redis data
structure, which may already exist on the `redis-server`.

    // eventScores is a redis sorted set where all the values are player IDs.
    var eventId = 1;
    var eventScores = redis_objects.SortedSet('eventScore:' + eventId, {marshal: 'Integer'});
    eventScores.add(/* player ID */ 1, /* score */ 2, function(e, res) {
      // res is 1, because one item was added.
    });
    eventScores.addAll([[2, 3], [4, 1]], function(e, res) {});
    eventScores.slice(0, 3, function(e, res) {
      // res is now [4, 1]
    });

## Installation and Setup

Add it to your application's package.json, or run:

    npm install redis-objects --save

Then, set up the redis-object connection:

    var redis_objects = require('redis-objects');
    var redis = require('redis');

    // This sets it up globally:
    redis_objects.connect(redis.createClient());

    // You can also set it when creating a new redis object:
    var newValue = new redis_objects.Value('testKey', redis.createClient(6379));

## Documentation

Sweet sweet comprehensive documentation will be forthcoming.

## Note on Patches/Pull Requests/How to develop

1. Fork the project.
2. Make your feature addition or bug fix.
3. Add tests for it. This is important so I don’t break it in a future version unintentionally.
4. Run the tests, either using `npm test` or `npm test --cover` (this will also generate a pretty coverage report.)
5. Commit your changes.
6. Send me a pull request.
7. Bam! Done!
