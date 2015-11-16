# feathers-rethinkdb
Create a RethinkDB service for FeathersJS.

## Not ready for production. It's only passing some of the tests.  
To help with development, you can run the tests with `npm run test`.

## TODO: implement
- [x] create (insert): https://www.rethinkdb.com/api/javascript/insert/
- [x] get (replace): https://www.rethinkdb.com/api/javascript/get/
- [x] remove: https://www.rethinkdb.com/api/javascript/delete/
- [ ] find 
	- [x] Returns all items.
	- [x] Filters results by a single parameter.
	- [x] Filters results by multiple parameters.
    - [x] $sort (orderBy) https://www.rethinkdb.com/api/javascript/order_by/
        - [ ] create indexes on the fly. Needed for a more efficient orderBy: https://www.rethinkdb.com/api/javascript/index_create/
    - [x] $limit: https://www.rethinkdb.com/api/javascript/limit/
    - [x] $skip: https://www.rethinkdb.com/api/javascript/skip/
    - [x] $select: (pluck) https://www.rethinkdb.com/api/javascript/pluck/
    - [ ] $joins: https://www.rethinkdb.com/api/javascript/inner_join/
    - [x] $or
	    - [ ] $or needs some cleanup.  Can use the `parseQuery` function
	    - [ ] Test some more-complex query scenarios since this adapter has to manually support MondoDB-style queries.
    - [ ] $in
    - [ ] $nin
    - [x] $lt
    - [x] $lte
    - [x] $gt
    - [x] $gte
    - [x] $ne
    - [x] $eq
- [x] update (replace): https://www.rethinkdb.com/api/javascript/replace/
- [x] patch (update): https://www.rethinkdb.com/api/javascript/update/
- [ ] docs

