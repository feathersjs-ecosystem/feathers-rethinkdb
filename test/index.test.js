import chai from 'chai';
import { base } from 'feathers-service-tests';
// import { base, example } from 'feathers-service-tests';
import errors from 'feathers-errors';
import service from '../src';
import rethink from 'rethinkdbdash';
// import server from './test-app';
const r = rethink({
  db: 'feathers'
});

let expect = chai.expect;
let _ids = {};
let people = service({r, table: 'people'});

function clean(done) {
  r.table('people').delete().run()
    .then(() => {
      return r.table('todos').delete().run();
    })
    .then(() => {
      done();
    })
    .catch(() => {
      done();
    });
}

function create(done) {
  r.dbList().contains('feathers')
    // Create the db if it doesn't exist.
    .do(function(databaseExists) {
      return r.branch( databaseExists, { created: 0 }, r.dbCreate('feathers') );
    })
    .run()
    // Create the todos table if it doesn't exist.
    .then(() => {
      return r.db('feathers').tableList().contains('todos')
        .do(function(tableExists) {
          return r.branch( tableExists, { created: 0 }, r.db('feathers').tableCreate('todos') );
        }).run();
    })
    // Create the people table if it doesn't exist.
    .then(() => {
      return r.db('feathers').tableList().contains('people')
        .do(function(tableExists) {
          return r.branch( tableExists, { created: 0 }, r.db('feathers').tableCreate('people') );
        }).run();
    })
    .then(() => {
      done();
    });
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
    people.remove().then(() => {
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

// describe('RethinkDB service example test', () => {
//   after(done => server.close(() => done()));
//
//   example('_id');
// });
