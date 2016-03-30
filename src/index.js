import Proto from 'uberproto';
import filter from 'feathers-query-filters';
import { types as errors } from 'feathers-errors';
import _ from 'lodash';
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
      params = params || {};

      let query;
      // If an id was passed, just get the record.
      if (id && !params) {
        query = this.table.get(id);

      // Allow querying by params other than id.
      } else {
        params.query = params.query || {};
        params.query[this.id] = id;
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
        .catch(err => {
          reject(err);
        });
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
        .catch(err => {
          return reject(err);
        });
    });
  }

  // STILL NEED TO ADD params argument here.
  patch(id, data) {
    return new Promise((resolve, reject) => {
      // Find the original record, first.
      this.get(id, {}, function(error, getData){
        if(error){
          return reject(error);
        }

        // Run the query
        this.table.get(id).update(data).run()
          .then((err, response) => {
            if (err) {
              return reject(err);
            }
            if (!response) {
              return reject(new errors.NotFound('No record found for id ' + id));
            }
            if (response.replaced) {
              var finalData = _.merge(getData, data);
              // Send response.
              resolve(finalData);
            }
          });
      });
    });
  }

  // Not sure if we need the params here.
  update(id, data) {
    return new Promise((resolve, reject) => {
      // Find the original record, first.
      this.get(id)
        .then(getData => {
          getData.id = id;
          // Update the found record.
          this.table.get(id).replace(data).run()
            .then(res => {
              if (!res) {
                return reject(new errors.NotFound('No record found for id ' + id));
              }
              if (res.replaced) {
                return resolve(data);
              }
            })
            .catch(err => {
              return reject(err);
            });
        })
        .catch(err => {
          return reject(err);
        });
      });
  }

  remove(id, params) {
    return new Promise((resolve, reject) => {
      let query = this.table.get(id);
      params = params || {};

      if (!id) {
        params.query = params.query || {};
        query = this.table.filter(params.query);
      }
      query.delete({returnChanges: true}).run()
        .then(res => {
          if (!res.changes) {
            return resolve([]);
          } else if (res.changes.length <= 1) {
            return resolve(res.changes[0] && res.changes[0].old_val);
          } else {
            let changes = res.changes.map(changed => {
              return changed.old_val;
            });
            return resolve(changes);
          }
        })
        .catch(err => {
          return reject(err);
        });
    });
  }
}

export default function init(options) {
  return new Service(options);
}

init.Service = Service;
