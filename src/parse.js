/**
 * Pass in a query object to get a ReQL query
 * Must be run after special query params are removed.
 */
export default function parseQuery(r, obj){
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
