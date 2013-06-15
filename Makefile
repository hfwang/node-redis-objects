SPEC = spec/spec.js

test:
	./node_modules/istanbul/lib/cli.js test ./node_modules/mocha/bin/_mocha spec -- --check-leaks -R spec

test-w:
	./node_modules/.bin/mocha --watch --growl --reporter min spec

coverage:
	./node_modules/istanbul/lib/cli.js cover ./node_modules/mocha/bin/_mocha -R spec spec
	open coverage/lcov-report/index.html

lint:
	node_modules/.bin/jshint index.js lib spec

init-testing update-testing:
	npm install

.PHONY: test test-w init-testing update-testing
