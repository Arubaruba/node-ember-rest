var promise = require('bluebird');

module.exports = function (db) {
  return function (models) {
    var modelName = Object.keys(models)[0];
    if (models[modelName] instanceof Array) {
      return promise.all(models[modelName].map(function(model) {
        return resolveIds(model);
      })).then(function() {
        return models;
      });
    } else {
      return resolveIds(models[modelName]).then(function() {
        return models;
      });
    }

    function isId(id) {
      var idString = '==';
      return id.substring(id.length - idString.length) == idString;
    }

    function resolveIds(recordValue) {
      var ids = [];
      Object.keys(recordValue).forEach(function (key) {
        var property = recordValue[key];
        if (property instanceof Array && property.length > 0 && isId(property[0])) {
          ids = ids.concat(property);
        } else if (typeof(property) == 'string' && isId(property)) {
          ids.push(property);
        }
      });

      return new promise(function (resolve, reject) {
        var promises = [];
        var read = db.createReadStream();
        read.on('data', function (record) {
          var keyParts = record.key.split('/');
          var model = keyParts[0];
          var id = keyParts[1];

          if (ids.indexOf(id) != -1) {
            if (!models[model]) {
              models[model] = [];
            }
            if (models[model] && !(models[model] instanceof Array)) {
              throw('Single model in place of plural model');
            } else {
              var existingRecord = false;
              models[model].forEach(function (data) {
                if (data.id == id) {
                  existingRecord = true;
                }
              });
              if (!existingRecord) {
                record.value.id = id;
                models[model].push(record.value);
                promises.push(resolveIds(record.value));
              }
            }
          }
        });
        read.on('error', function (err) {
          reject(err);
        });
        read.on('end', function () {
          resolve(promises);
        });
      });
    }
  }
};