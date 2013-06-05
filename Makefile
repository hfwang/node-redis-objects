SPEC = spec/spec.js

test:
	./node_modules/.bin/mocha --check-leaks -R spec spec

test-w:
	./node_modules/.bin/mocha --watch --growl --reporter min spec

lint:
	node_modules/.bin/jshint index.js lib spec

init-testing update-testing:
	npm install

.PHONY: test test-w init-testing update-testing
