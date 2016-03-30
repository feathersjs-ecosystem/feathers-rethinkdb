import Proto from 'uberproto';
import filter from 'feathers-query-filters';
import { types as errors } from 'feathers-errors';
import parseQuery from './parse';

// Create the service.
class Service {
  constructor(options){
    if(!options){
      throw new SyntaxError('RethinkDB options have to be provided.');
    }

    if (!options.r) {
      throw new SyntaxError('You must provide the RethinkDB object on options.r');
    }

    if (!options.table) {
      throw new SyntaxError('You must provide a table name on options.table');
    }

    this.type = 'rethinkdb';
    this.id = options.id || 'id';
    this.table = options.r.table(options.table);
    this.options = options;
  }

  extend(obj) {
    return Proto.extend(obj, this);
  }

  find(params) {
    return new Promise((resolve, reject) => {
      // Start with finding all, and limit when necessary.
      var query = this.table.filter({});

      // Prepare the special query params.
      if (params && params.query) {
        var filters = filter(params.query);

        // Handle $select
        if (filters.$select) {
          query = query.pluck(filters.$select);
        }

        // Handle $sort
        if (filters.$sort){
          var fieldName = Object.keys(filters.$sort)[0];
          if (filters.$sort[fieldName] === 1) {
            query = query.orderBy(fieldName);
          } else {
            query = query.orderBy(this.options.r.desc(fieldName));
          }
        }

        // Handle $limit
        if (filters.$limit){
          query = query.limit(filters.$limit);
        }

        // Handle $skip
        if (filters.$skip){
          query = query.skip(filters.$skip);
        }

        // Parse the rest of the query for sub-queries.
        // var queryKeys = Object.keys(params.query);
        // for (var qkIndex = 0; qkIndex < queryKeys.length; qkIndex++) {
        //   var queryKey = queryKeys[qkIndex];
        // }
        //
        if (params.query.$or) {
          // orQuery will be built and passed to row('rowName').filter().
          var orQuery;
          // params.query.$or looks like [ { name: 'Alice' }, { name: 'Bob' } ]
          // Needs to become:
          // r.row("name").eq('Alice').or(r.row("name").eq('Bob'))
          for (var i = 0; i < params.query.$or.length; i++) {
            // queryObject looks like { name: 'Alice' }
            var queryObject = params.query.$or[i];
            var keys = Object.keys(queryObject);

            for (var n = 0; n < keys.length; n++) {
              // The queryObject's key: 'name'
              var qField = keys[n];
              // The queryObject's value: 'Alice'
              var qValue = queryObject[qField];

              // Build the subQuery based on the qField.
              var subQuery;
              // If the qValue is an object, it will have special params in it.
              if (typeof qValue !== 'object') {
                subQuery = this.options.r.row(qField).eq(qValue);
              }

              // At the end of the current set of attributes, determine placement.
              // if (!next) {
              //   if (i === 0) {
              //     orQuery = subQuery;
              //   } else {
              //     orQuery = orQuery.or(subQuery);
              //   }
              // }
            }
          }
          query = query.filter(orQuery);
          delete params.query.$or;
        }
        query = query.filter(parseQuery(this.options.r, params.query));
      }

      // Execute the query
      return query.run().then(data => {
        // if (this.options.returnCursors) {
        //   return callback(err, cursor);
        // }
        return resolve(data);
      })
      .catch(err => {
        console.log(err);
        reject(err);
      });
    });
  }

  get(id, params) {
    return new Promise((resolve, reject) => {
      let query;
      // If an id was passed, just get the record.
      if (id !== null && id !== undefined) {
        query = this.table.get(id);

      // If no id was passed, use params.query
      } else {
        params = params || {query:{}};
        query = this.table.filter(params.query).limit(1);
      }

      query.run()
        .then(data => {
          if (Array.isArray(data)) {
            data = data[0];
          }
          if(!data) {
            return reject(new errors.NotFound(`No record found for id '${id}'`));
          }
          return resolve(data);
        })
        .catch(reject);
    });
  }

  // STILL NEED TO ADD params argument here.
  create(data) {
    return new Promise((resolve, reject) => {
      this.table.insert(data).run()
        .then(res => {
          data.id = res.generated_keys[0];
          return resolve(data);
        })
        .catch(reject);
    });
  }

  patch(id, data, params) {
    return new Promise((resolve, reject) => {
      let query;
      if (id !== null && id !== undefined) {
        query = this.get(id);
      } else if (params) {
        query = this.find(params);
      } else {
        return reject(new Error('Patch requires an ID or params'));
      }
      // Find the original record(s), first, then patch them.
      query.then(getData => {
        let query;
        if (Array.isArray(getData)) {
          let ids = getData.map(item => item.id);
          query = this.table.getAll(...ids);
        } else {
          query = this.table.get(id);
        }
        query.update(data, {returnChanges: true}).run()
          .then(response => {
            let changes = response.changes.map(change => change.new_val);
            resolve(changes.length === 1 ? changes[0] : changes);
          })
          .catch(reject);
      })
      .catch(reject);
    });
  }

  update(id, data) {
    return new Promise((resolve, reject) => {
      // Find the original record, first, then update it.
      this.get(id)
        .then(getData => {
          data.id = id;
          this.table.get(getData.id).replace(data, {returnChanges: true}).run()
            .then(result => resolve(result.changes[0].new_val))
            .catch(reject);
        })
        .catch(reject);
      });
  }

  remove(id, params) {
    return new Promise((resolve, reject) => {
      let query;

      // You have to pass id=null to remove all records.
      if (id !== null && id !== undefined) {
        query = this.table.get(id);
      } else {
        params = params || {};
        params.query = params.query || {};
        query = this.table.filter(params.query);
      }
      query.delete({returnChanges: true}).run()
        .then(res => {
          if (!res.changes) {
            return resolve([]);
          } else {
            let changes = res.changes.map(change => change.old_val);
            return resolve(changes.length === 1 ? changes[0] : changes);
          }
        })
        .catch(reject);
    });
  }
}

export default function init(options) {
  return new Service(options);
}

init.Service = Service;
