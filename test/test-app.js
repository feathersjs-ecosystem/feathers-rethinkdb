const rethink = require('rethinkdbdash');
const feathers = require('feathers');
const rest = require('feathers-rest');
const socketio = require('feathers-socketio');
const bodyParser = require('body-parser');
const service = require('../lib').default;
const r = rethink();

const todoService = service({
  r,
  table: 'todos',
  paginate: {
    default: 2,
    max: 4
  }
});

// Create a feathers instance.
var app = feathers()
  // Enable REST services
  .configure(rest())
  // Enable Socket.io services
  .configure(socketio())
  // Turn on JSON parser for REST services
  .use(bodyParser.json())
  // Turn on URL-encoded parser for REST services
  .use(bodyParser.urlencoded({extended: true}))
  .use('/todos', todoService);


// Start the server.
const port = 3030;

module.exports = app.listen(port);
