# feathers-rethinkdb

[![Build Status](https://travis-ci.org/feathersjs/feathers-rethinkdb.svg?branch=master)](https://travis-ci.org/feathersjs/feathers-rethinkdb)

> Create a [RethinkDB](https://rethinkdb.com/) Service for [FeatherJS](https://github.com/feathersjs).

## Installation

```bash
npm install rethinkdbdash feathers-rethinkdb --save
```

## Documentation

Please refer to the [Feathers database adapter documentation](http://docs.feathersjs.com/databases/readme.html) for more details or directly at:

- [RethinkDB](http://docs.feathersjs.com/databases/rethinkdb.html) - The detailed documentation for this adapter
- [Extending](http://docs.feathersjs.com/databases/extending.html) - How to extend a database adapter
- [Pagination and Sorting](http://docs.feathersjs.com/databases/pagination.html) - How to use pagination and sorting for the database adapter
- [Querying](http://docs.feathersjs.com/databases/querying.html) - The common adapter querying mechanism

The `feathers-rethinkdb` adapter is built to use [`rethinkdbdash`](https://github.com/neumino/rethinkdbdash), which is a progressive version of the RethinkDB node driver which simplifies the connection process.  It also provides some other benefits like connection pooling .

## Complete Example

Here's an example of a Feathers server with a `messages` RethinkDB service.

```js
const rethink = require('rethinkdbdash');
const feathers = require('feathers');
const rest = require('feathers-rest');
const socketio = require('feathers-socketio');
const bodyParser = require('body-parser');
const service = require('../lib');

// Connect to a local RethinkDB server.
const r = rethink({
  db: 'feathers'
});

// Create a feathers instance.
var app = feathers()
  // Enable the REST provider for services.
  .configure(rest())
  // Enable the socketio provider for services.
  .configure(socketio())
  // Turn on JSON parser for REST services
  .use(bodyParser.json())
  // Turn on URL-encoded parser for REST services
  .use(bodyParser.urlencoded({extended: true}));

// Create your database if it doesn't exist.
r.dbList().contains('feathers')
  .do(dbExists => r.branch(dbExists, {created: 0}, r.dbCreate('feathers'))).run()

  // Create the table if it doesn't exist.
  .then(() => {
    return r.db('feathers').tableList().contains('messages')
      .do(tableExists => r.branch( tableExists, {created: 0}, r.dbCreate('messages'))).run();
  })
		
  // Create and register a Feathers service.
  .then(() => {
    app.use('messages', service({
      Model: r,
      name: 'messages',
      paginate: {
        default: 10,
        max: 50
      }
    }));
  })
  .catch(err => console.log(err));

// Start the server.
var port = 3030;
app.listen(port, function() {
  console.log(`Feathers server listening on port ${port}`);
});
```

You can run this example by using `node example/app` and going to [localhost:3030/messages](http://localhost:3030/messages). You should see an empty array. That's because you don't have any Todos yet but you now have full CRUD for your new messages service.

## Changelog

__0.2.0__

- Some minor cleanup
- Getting all tests passing
- Adding support for change feeds

__0.1.0__

- Initial release.


## License

Copyright (c) 2016

Licensed under the [MIT license](LICENSE).


## Author

[Marshall Thompson](https://github.com/marshallswain)
