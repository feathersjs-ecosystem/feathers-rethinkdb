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
const app = feathers()
  // Enable the REST provider for services.
  .configure(rest())
  // Enable the socketio provider for services.
  .configure(socketio())
  // Turn on JSON parser for REST services
  .use(bodyParser.json())
  // Turn on URL-encoded parser for REST services
  .use(bodyParser.urlencoded({
    extended: true
  }));

// Create your database if it doesn't exist.
r.dbList().contains('feathers')
  .do(dbExists => r.branch(dbExists, {
    created: 0
  }, r.dbCreate('feathers'))).run()
  // Create the table if it doesn't exist.
  .then(() =>
    r.dbList().contains('messages')
    .do(tableExists => r.branch(
      tableExists, {
        created: 0
      },
      r.dbCreate('messages'))).run()
  )
  // Create and register a Feathers service.
  .then(() => {
    app.use('messages', service({
      Model: r,
      x
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
