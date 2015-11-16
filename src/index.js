import Proto from 'uberproto';
import filter from 'feathers-query-filters';
import r from 'rethinkdb';
import { types as errors } from 'feathers-errors';
import _ from 'lodash';

// Create the service.
export const Service = Proto.extend({
  init: function(name, options = {}){
    var self = this;

    if(!name){
      throw new SyntaxError('You must pass a String as the name of the table ' +
        '(if you\'re connecting to a server at localhost:28015), or a configuration object.');
    }

    if (!options.table) {
      options = {
        table: name
      };
    }

    var defaults = {
      host: 'localhost',
      port: 28015,
      db: 'feathers',
      table: '',
      returnCursors: false
    };
    options = _.merge(defaults, options);

    this.type = 'rethinkdb';
    this.id = options.id || 'id';
    this.name = name;
    this.options = options;
    var connectionOptions = {
      host: options.host,
      port: 28015
    };

    // TODO: handle failed connections.
    this.ready = new Promise(function(resolve){
      r.connect(connectionOptions)
      .then(function(connection){
        // Create the db if it doesn't exist.
        self.connection = connection;
        return r.dbList().contains(options.db).do(function(databaseExists) {
          return r.branch(
            databaseExists,
            { created: 0 },
            r.dbCreate(options.db)
          );
        }).run(connection);
      }).then(function(){
        // Create the table if it doesn't exist.
        self.connection.use(options.db);
        return r.db(options.db).tableList().contains(options.table).do(function(tableExists) {
          return r.branch(
            tableExists,
            { created: 0 },
            r.db(options.db).tableCreate(options.table)
          );
        }).run(self.connection);
      }).then(function(){
        resolve(self.connection);
      });
    });
  },

  find: function(params, callback) {
    var self = this;

    self.ready.then(function(connection){
      // Start with finding all, and limit when necessary.
      var query = r.table(self.options.table).filter({});

      // Prepare the special query params.
      if (params.query) {
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
            query = query.orderBy(r.desc(fieldName));
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
            // console.log(queryObject);
            var keys = Object.keys(queryObject);

            for (var n = 0; n < keys.length; n++) {
              // The queryObject's key: 'name'
              var qField = keys[n];
              // The queryObject's value: 'Alice'
              var qValue = queryObject[qField];


              // Build the subQuery based on the qField.
              var subQuery;
              // If the qValue is an object, it will have special params in it.
              if (typeof qValue === 'object') {
                // switch(qField){
                //   case '$or':
                //     break;
                //   case '$in':
                //     break;
                //   case '$nin':
                //     subQuery = r.row(qField).lt(qValue);
                //     break;
                //   case '$lt':
                //     subQuery = r.row(qField).lt(qValue);
                //     break;
                //   case '$lte':
                //     subQuery = r.row(qField).le(qValue);
                //     break;
                //   case '$gt':
                //     subQuery = r.row(qField).gt(qValue);
                //     break;
                //   case '$gte':
                //     subQuery = r.row(qField).ge(qValue);
                //     break;
                //   case '$ne':
                //     subQuery = r.row(qField).ne(qValue);
                //     break;
                //   case '$eq':
                //     subQuery = r.row(qField).eq(qValue);
                //     break;
                // }
              } else {
                subQuery = r.row(qField).eq(qValue);
              }


              // Determine if there's a next key.
              var next = !!keys[n + 1];

              // At the end of the current set of attributes, determine placement.
              if (!next) {
                if (i === 0) {
                  orQuery = subQuery;
                } else {
                  orQuery = orQuery.or(subQuery);
                }
              }
            }
          }
          query = query.filter(orQuery);
          delete params.query.$or;
        }
        // console.log(params.query);
        query = query.filter(parseQuery(params.query));
      }

      // Execute the query
      query.run(connection, function(err, cursor) {
        if (err) {
          return callback(err);
        }
        if (self.options.returnCursors) {
          return callback(err, cursor);
        }
        cursor.toArray(function(err, data){
          // console.log(data);
          return callback(err, data);
        });
      });
    });


  },

  get(id, params, callback) {
    var self = this;
    var args = arguments;

    self.ready.then(function(connection){
      if (typeof id === 'function') {
        callback = id;
        return callback(new errors.BadRequest('An id is required for GET operations'));
      }

      var query;
      // If an id was passed, just get the record.
      if (args.length === 3) {
        query = r.table(self.options.table).get(id);

      // Allow querying by params other than id.
      } else {
        params.query = params.query || {};
        params.query[this.id] = id;
        query = r.table(self.options.table).filter(params.query).limit(1);
      }

      query.run(connection, function(err, data){
        if (err) {
          return callback(err);
        }
        if(!data) {
          return callback(new errors.NotFound(`No record found for id '${id}'`));
        }
        return callback(err, data);
      });
    });

  },

  create: function(data, params, callback) {
    var self = this;
    this.ready.then(function(connection){
      r.table(self.options.table).insert(data).run(connection, function(err, res) {
        if(err) {
          return callback(err);
        }
        data.id = res.generated_keys[0];
        return callback(null, data);
      });
    });
  },

  patch: function(id, data, params, callback) {
    var self = this;

    self.ready.then(function(){
      // Remove id and/or _id.
      delete data.id;
      delete data._id;

      // Run the query
      this.db.update({'_id':id}, {$set:data}, {}, function(err, count) {

        if (err) {
          return callback(err);
        }

        if (!count) {
          return callback(new errors.NotFound('No record found for id ' + id));
        }

        self.db.findOne({_id: id}, function(err, doc) {
          if (err) {
            return callback(err);
          }
          // Send response.
          callback(err, doc);
        });
      });
    });

  },

  update: function(id, data, params, callback) {
    var self = this;
    self.ready.then(function(connection){

      self.get(id, {}, function(error){
        if(error){
          return callback(error);
        }
        // Remove id.
        delete params[self.id];
        data.id = id;

        // Run the query
        r.table(self.options.table).get(id).replace(data).run(connection, function(err, response){
          if (err) {
            return callback(err);
          }
          console.log(response);
          if (!response) {
            return callback(new errors.NotFound('No record found for id ' + id));
          }
          if (response.replaced) {
            // Send response.
            callback(null, data);
          }
        });
      });
    });

  },

  remove: function(id, params, callback) {
    var self = this;
    self.ready.then(function(connection){
      r.table(self.options.table).get(id).delete({returnChanges: true}).run(connection, function(err, res) {
        if (err) {
          return callback(err);
        }
        return callback(null, res.changes[0] && res.changes[0].old_val || {id: id});
      });
    });

  },

  setup: function(app) {
    this.app = app;
    this.service = app.service.bind(app);
  }
});

export default function() {
  return Proto.create.apply(Service, arguments);
}

/**
 * Pass in a query object to get a ReQL query
 * Must be run after special query params are removed.
 */
function parseQuery(obj){
  var reQuery;
  var theKeys = Object.keys(obj);
  for (var index = 0; index < theKeys.length; index++) {
    var subQuery;
    // The queryObject's key: 'name'
    var qField = theKeys[index];
    // The queryObject's value: 'Alice'
    var qValue = obj[qField];

    // If the qValue is an object, it will have special params in it.
    if (typeof qValue === 'object') {
      switch(Object.keys(obj[qField])[0]){
        /**
         *  name: { $in: ['Alice', 'Bob'] }
         *  becomes
         *  r.expr(['Alice', 'Bob']).contains(doc['name'])
         */
        case '$in':
          // subQuery = r.expr(qValue.$in).contains(doc[qField]);
          break;
        case '$nin':
          // subQuery = r.expr(qValue.$in).contains(doc[qField]).not();
          break;
        case '$lt':
          subQuery = r.row(qField).lt(obj[qField].$lt);
          break;
        case '$lte':
          subQuery = r.row(qField).le(obj[qField].$lte);
          break;
        case '$gt':
          subQuery = r.row(qField).gt(obj[qField].$gt);
          break;
        case '$gte':
          subQuery = r.row(qField).ge(obj[qField].$gte);
          break;
        case '$ne':
          subQuery = r.row(qField).ne(obj[qField].$ne);
          break;
        case '$eq':
          subQuery = r.row(qField).eq(obj[qField].$eq);
          break;
      }
    } else {
      subQuery = r.row(qField).eq(qValue);
    }

    // At the end of the current set of attributes, determine placement.
    if (index === 0) {
      reQuery = subQuery;
    } else {
      reQuery = reQuery.and(subQuery);
    }
  }

  return reQuery || {};
}
