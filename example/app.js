'use strict';

const rethink = require('rethinkdbdash');
const feathers = require('feathers');
const rest = require('feathers-rest');
const socketio = require('feathers-socketio');
const bodyParser = require('body-parser');
const service = require('../lib');
const r = rethink({
  db: 'feathers'
});

r.db('feathers').tableList().contains('todos')
  .do(function (tableExists) {
    return r.branch(
      tableExists, {
        created: 0
      },
      r.db('feathers').tableCreate('todos')
    );
  }).run();

let counter = 0;
const todoService = service({
  Model: r,
  name: 'todos',
  paginate: {
    default: 2,
    max: 4
  }
}).extend({
  _find (params) {
    params = params || {};
    params.query = params.query || {};
    if (!params.query.$sort) {
      params.query.$sort = {
        counter: 1
      };
    }

    return this._super(params);
  },

  create (data, params) {
    data.counter = ++counter;
    return this._super(data, params);
  }
});

// Create a feathers instance.
let app = feathers()
  // Enable REST services
  .configure(rest())
  // Enable Socket.io services
  .configure(socketio())
  // Turn on JSON parser for REST services
  .use(bodyParser.json())
  // Turn on URL-encoded parser for REST services
  .use(bodyParser.urlencoded({
    extended: true
  }))
  .use('/todos', todoService);

// Start the server.
const port = 3030;

// require('http').createServer();
module.exports = app.listen(port);
