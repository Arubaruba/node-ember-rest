var promise = require('bluebird');

module.exports = function (db) {
  return function (models) {
    var records = [];
    // The record value may be an object or an array
    if (!recordValue instanceof Array) {
      recordValue.single = true;
    }
    return recordValue;
  }
};