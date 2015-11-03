// Functions for modifying data / params
var Proto = require('uberproto');
var filter = require('feathers-query-filters');
var r = require('rethinkdb');
var errors = require('feathers-errors').types;
var _ = require('lodash');


// Create the service.
var rethinkService = Proto.extend({
	init: function(options){
		var self = this;

		var name, path = 'db-data/';

		if(!options){
			throw new SyntaxError('You must pass a String as the name of the table ' +
				'(if you\'re connecting to a server at localhost:28015), or a configuration object.');
		}

		if (typeof options === 'string') {
			options = {
				table: options
			};
		}

		var defaults = {
			host: 'localhost',
			port: 28015,
			db: 'feathers',
			table: ''
		};
		options = _.merge(defaults, options);


		if (options.table === '') {
			throw new SyntaxError('`options.table` is required. Please pass a String as the name of the table.');
		}

		this.filename = path + name;
		this.type = 'rethinkdb';
		this.options = options;
		var connectionOptions = { 
			host: options.host, 
			port: 28015
		};

		// TODO: handle failed connections.
		this.ready = new Promise(function(resolve, reject){
			r.connect(connectionOptions)
			.then(function(connection){
				self.connection = connection;
				return r.dbList().contains(options.db).do(function(databaseExists) {
			    return r.branch(
			      databaseExists,
			      { created: 0 },
			      r.dbCreate(options.db)
			    );
			  }).run(connection);
			}).then(function(){
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

				// $select uses a specific find syntax, so it has to come first.
				// if (filters.$select) {
				// 	query = this.db.find(params.query, filters.$select);
				// } else {
				// 	query = this.db.find(params.query);
				// }

				// Handle $sort
				if (filters.$sort){
					query.sort(filters.$sort);
				}

				// Handle $limit
				if (filters.$limit){
					query.limit(filters.$limit);
				}

				// Handle $skip
				if (filters.$skip){
					query.skip(filters.$skip);
				}
			}

			// Execute the query
			query.exec(function(err, docs) {
				if (err) {
					return callback(err);
				}

				// Support either id or _id
				docs.forEach(function(doc){
					doc.id = doc._id;
				});
				return callback(err, docs);
			});
		});

		
	},

	// TODO: Maybe make it an option to findOne by another attribute.
	get: function(id, params, callback) {
		var self = this;
		self.ready.then(function(connection){
			if (typeof id === 'function') {
				return callback(new errors.BadRequest('An id is required for GET operations'));
			}

			r.table(self.options.table).get(id).run(connection, function(err, data){
				if (err) {
					return callback(err);
				}
				if(!data) {
	        return callback(new errors.NotFound('No record found for id ' + id));
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
		self.ready.then(function(){
			// Remove id and/or _id.
			delete data.id;
			delete data._id;

			// Run the query
			this.db.update({'_id':id}, data, {}, function(err, count) {
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

module.exports = function(name, path) {
  return Proto.create.call(rethinkService, name, path);
};

module.exports.Service = rethinkService;
