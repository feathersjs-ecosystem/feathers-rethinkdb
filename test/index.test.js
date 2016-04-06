import chai from 'chai';
import { base, example } from 'feathers-service-tests';
import errors from 'feathers-errors';
import service from '../src';
import rethink from 'rethinkdbdash';
import server from './test-app';
const r = rethink({
  db: 'feathers'
});

// RethinkDB: if no other sort order is given. This means that items can not be returned in the
// same order they have been created so this counter is used for sorting instead.
let counter = 0;

let expect = chai.expect;
let _ids = {};

let people = service({
  Model: r,
  name: 'people'
}).extend({
  _find(params) {
    params = params || {};
    params.query = params.query || {};
    if(!params.query.$sort) {
      params.query.$sort = { counter: 1 };
    }

    return this._super(params);
  },

  create(data, params) {
    data.counter = ++counter;
    return this._super(data, params);
  }
});

function clean(done) {
  r.table('people').delete(null).run()
    .then(() => r.table('todos').delete().run())
    .then(() => r.db('test').table('todos').delete().run())
    .then(() => done())
    .catch(done);
}

function create(done) {
  counter = 0;
  // Create the db if it doesn't exist.
  r.dbList().contains('feathers').do(databaseExists => r.branch( databaseExists, { created: 0 }, r.dbCreate('feathers'))).run()
    .then(() => {
      console.log('feathers DATABASE CREATED');
      return r.dbList().contains('test').do(databaseExists => r.branch( databaseExists, { created: 0 }, r.dbCreate('test'))).run();
    })
    // Create the todos table if it doesn't exist.
    .then(() => {
      console.log('test DATABASE CREATED');
      r.db('feathers').tableList().contains('todos')
        .do(function(tableExists) {
          return r.branch( tableExists, { created: 0 }, r.db('feathers').tableCreate('todos') );
        }).run();
      }
    )
    .then(() => {
      console.log('feathers.todos TABLE CREATED.');
      r.db('test').tableList().contains('todos')
        .do(function(tableExists) {
          return r.branch( tableExists, { created: 0 }, r.db('test').tableCreate('todos') );
        }).run();
      }
    )
    // Create the people table if it doesn't exist.
    .then(() => {
      console.log('test.todos TABLE CREATED.');
      return r.db('feathers').tableList().contains('people')
        .do(function(tableExists) {
          return r.branch( tableExists, { created: 0 }, r.db('feathers').tableCreate('people') );
        }).run();
    })
    .then(() => {
      console.log('DONE CREATING TABLES.');
      done();
    })
    .catch(err => console.log(err));
}


describe('feathers-rethinkdb', () => {

  before(create);
  after(clean);

  beforeEach(done => {
    people.create({
      name: 'Doug',
      age: 32
    }, {})
      .then(data => {
        _ids.Doug = data.id;
        done();
      })
      .catch(err => {
        done(err);
      });
  });

  afterEach(done => {
    people.remove(null).then(() => {
      done();
    })
    .catch(done);
  });

  it('basic functionality', done => {
    expect(typeof 1).to.equal('number');
    done();
  });
  base(people, _ids, errors.types);
});

describe('RethinkDB service example test', () => {
  after(done => server.close(() => done()));

  example('id');
});
