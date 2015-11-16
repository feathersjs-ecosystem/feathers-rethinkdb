# feathers-rethinkdb
Create a RethinkDB service for FeathersJS.

## Not ready for production. It's only passing some of the tests.  
To help with development, you can run the tests with `npm run mocha`.

## TODO: implement
- [x] create (insert): https://www.rethinkdb.com/api/javascript/insert/
- [x] get (replace): https://www.rethinkdb.com/api/javascript/get/
- [x] remove: https://www.rethinkdb.com/api/javascript/delete/
- [ ] find 
	- [x] Returns all items.
	- [x] Filters results by a single parameter.
	- [x] Filters results by multiple parameters.
    - [ ] $sort (orderBy) https://www.rethinkdb.com/api/javascript/order_by/
        - [ ] create indexes on the fly. Needed for orderBy: https://www.rethinkdb.com/api/javascript/index_create/
    - [ ] $limit: https://www.rethinkdb.com/api/javascript/limit/
    - [ ] $skip: https://www.rethinkdb.com/api/javascript/skip/
    - [ ] $nth: https://www.rethinkdb.com/api/javascript/nth/
    - [ ] $slice: https://www.rethinkdb.com/api/javascript/slice/
    - [ ] $select: (pluck) https://www.rethinkdb.com/api/javascript/pluck/
    - [ ] $joins: https://www.rethinkdb.com/api/javascript/inner_join/
- [ ] update (replace): https://www.rethinkdb.com/api/javascript/replace/
- [ ] patch (update): https://www.rethinkdb.com/api/javascript/update/
- [ ] changefeeds: https://www.rethinkdb.com/docs/changefeeds/javascript/

