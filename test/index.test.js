import chai from 'chai';
import { base, example } from 'feathers-service-tests';
import feathers from 'feathers';
import errors from 'feathers-errors';
import rethink from 'rethinkdbdash';
import service from '../src';

const r = rethink({
  db: 'feathers'
});

// RethinkDB: if no other sort order is given. This means that items can not be returned in the
// same order they have been created so this counter is used for sorting instead.
let counter = 0;

const expect = chai.expect;
const numberService = {
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
    const addCount = current => Object.assign({}, current, {
      counter: ++counter
    });

    if (Array.isArray(data)) {
      data = data.map(addCount);
    } else {
      data = addCount(data);
    }

    return this._super(data, params);
  }
};

const app = feathers()
  .use('/people', service({
    Model: r,
    name: 'people',
    watch: true,
    events: [ 'testing' ]
  }).extend(numberService))
  .use('/people-customid', service({
    id: 'customid',
    Model: r,
    name: 'people_customid',
    watch: true,
    events: [ 'testing' ]
  }).extend(numberService));
const people = app.service('people');

function clean (done) {
  r.table('people').delete(null).run()
    .then(() => r.table('todos').delete().run())
    .then(() => r.table('people_customid').delete().run())
    .then(() => done())
    .catch(done);
}

function create (done) {
  counter = 0;
  // Create the db if it doesn't exist.
  r.dbList().contains('feathers').do(databaseExists => r.branch(
    databaseExists, {
      created: 0
    },
    r.dbCreate('feathers')))
    .run()
    // Create the todos table if it doesn't exist.
    .then(() => {
      const table = r.db('feathers');

      return Promise.all([
        table.tableList().contains('todos')
          .do(function (tableExists) {
            return r.branch(
              tableExists, {
                created: 0
              },
              table.tableCreate('todos')
            );
          }).run(),
        table.tableList().contains('people_customid')
          .do(function (tableExists) {
            return r.branch(
              tableExists, {
                created: 0
              },
              table.tableCreate('people_customid', {
                primaryKey: 'customid'
              })
            );
          }).run(),
        table.tableList().contains('people')
          .do(function (tableExists) {
            return r.branch(
              tableExists, {
                created: 0
              },
              table.tableCreate('people')
            );
          }).run()
      ]);
    })
    .then(() => {
      app.setup();
      done();
    })
    .catch(done);
}

describe('feathers-rethinkdb', () => {
  before(create);
  after(clean);

  it('is CommonJS compatible', () => {
    expect(typeof require('../lib')).to.equal('function');
  });

  it('basic functionality', done => {
    expect(typeof 1).to.equal('number');
    done();
  });

  describe('common tests', () => {
    base(app, errors);
    base(app, errors, 'people-customid', 'customid');
  });

  describe('Changefeeds', () => {
    it('`created` and `removed`', done => {
      const table = r.db('feathers').table('people');

      people.once('created', person => {
        expect(person.name).to.equal('Marshall Thompson');
        expect(person.counter).to.equal(counter);
        table.get(person.id).delete().run();
      });

      people.once('removed', person => {
        expect(person.name).to.equal('Marshall Thompson');
        done();
      });

      table.insert({
        name: 'Marshall Thompson',
        counter: ++counter
      }).run();
    });

    it('`patched` and `updated`', done => {
      const table = r.db('feathers').table('people');

      people.once('created', person => {
        expect(person.name).to.equal('Marshall Thompson');
        person.name = 'Marshall T.';
        table.get(person.id).replace(person).run();
      });

      people.once('patched', person => expect(person.name).to.equal('Marshall T.'));

      people.once('updated', person => {
        expect(person.name).to.equal('Marshall T.');
        table.get(person.id).delete().run();
      });

      people.once('removed', () => done());

      table.insert({
        name: 'Marshall Thompson',
        counter: ++counter
      }).run();
    });
  });

  describe('array creates', function () {
    it('create works with an array', function (done) {
      people.create([{name: 'Test 1'}, {name: 'Test 2'}])
        .then(data => {
          expect(typeof data[0].id).to.not.equal('undefined');
          expect(typeof data[1].id).to.not.equal('undefined');
          done();
        });
    });
  });
});

describe('RethinkDB service example test', () => {
  before(done => {
    let server = require('../example/app');
    server.then((s) => {
      after(done => s.close(() => done()));
      done();
    });
  });

  example('id');
});

describe('init database', () => {
  it('service.init() initializes the database', done => {
    service({ Model: r, name: 'testTable' })
      .init()
      .then(() => {
        expect(r.tableList().contains('testTable'));
        r.table('testTable').delete(null).run()
          .then(() => {
            return done();
          })
          .catch(done);
      })
      .catch(done);
  });
});
