var promise = require('bluebird');
var url = require('url');
var crypto = promise.promisifyAll(require('crypto'));
var loadDependencies = require('./lib/load-dependencies');

var regex = /(\w+)\/?([^\/]+)?$/;

module.exports = function (options) {
  var db = promise.promisifyAll(options.levelup);

  return function (request, response, modelDefinitions) {
    var parsedUrl = url.parse(request.url);
    var match = regex.exec(parsedUrl.pathname.substring(options.namespace.length));
    var model, id, auth;

    return new promise(function (resolve, reject) {
      if (match === null) {
        throw('Invalid url format');
      } else if (!modelDefinitions[match[1]]) {
        throw('Invalid model type');
      } else {
        model = match[1];
        id = match[2];
        auth = modelDefinitions[model];

        if (request.method == 'POST' || request.method == 'PUT') {
          var data = '';
          request.on('data', function (chunk) {
            data += chunk;
          });
          request.on('error', function (err) {
            reject(err);
          });
          request.on('end', function () {
            var models = JSON.parse(data);
            if (Object.keys(models).length == 0) {
              throw ('Cannot create model with no data');
            } else {
              resolve(models);
            }
          });
        } else if (request.method == 'DELETE' || request.method == 'GET') {
          resolve({});
        } else {
          throw('Invalid Request method');
        }
      }
    }).then(function (models) {
        if (Object.keys(models).length > 0 || request.method == 'DELETE') {
          // Perform Write Operation
          if (auth.write === null) {
            throw ('Model needs auth \'write\' (can be bool or function)');
          } else {
            return new promise(function (resolve) {
              if (!id) {
                return crypto.randomBytesAsync(10).then(function (bytes) {
                  id = bytes.toString('base64').replace(/\//g, '');
                  resolve();
                  return null;
                });
              } else {
                resolve(db.getAsync(model + '/' + id));
              }
            }).then(function (data) {
                var newData;
                if (request.method != 'DELETE') {
                  var modelSingular = Object.keys(models)[0];
                  newData = models[modelSingular];
                }
                new promise(function (resolve) {
                  if (auth.write instanceof Function) {
                    return promise.promisify(auth.write)(data, newData).then(function (authAllow) {
                      if (authAllow !== true) {
                        throw ('Write denied');
                      } else {
                        resolve();
                      }
                    });
                  } else if (auth.write !== true) {
                    throw ('Write denied');
                  } else {
                    resolve();
                  }
                }).then(function () {
                    if (request.method != 'DELETE') {
                      // do not store the id twice (as a key and as a property) - if ember supplies it
                      if (newData.id) delete newData.id;
                      return db.putAsync(model + '/' + id, newData).then(function () {
                        var models = {};
                        newData.id = id;
                        models[model] = newData;
                        response.writeHead(200);
                        response.end(JSON.stringify(models));
                      });
                    } else {
                      return db.delAsync(model + '/' + id).then(function () {
                        response.writeHead(200);
                        response.end(JSON.stringify({}));
                      });
                    }
                  });
              });
          }
        } else {
          // Perform Read Operation
          if (auth.read === null) {
            throw ('Model needs auth \'read\' (can be bool or function)');
          } else {
            return new promise(function (resolve, reject) {
              var records = [];
              var read = db.createReadStream();
              read.on('data', function (record) {
                var correctRecord = true;
                var keyParts = record.key.split('/');
                if (model != keyParts[0] || (id && keyParts[1] != id)) {
                  correctRecord = false;
                } else if (parsedUrl.query) {
                  var keys = Object.keys(parsedUrl.query);
                  for (var i = 0; i < keys.length; i++) {
                    if (!record.value[keys[i]]) {
                      correctRecord = false;
                      break;
                    }
                  }
                }
                if (correctRecord) {
                  record.value.id = keyParts[1];
                  records.push(record);
                }
              });
              read.on('error', function (err) {
                reject(err);
              });
              read.on('end', function () {
                resolve(records);
              });
            }).map(function (record) {
                if (auth.read instanceof Function) {
                  return promise.promisify(auth.read)(record.value).then(function (authAllowed) {
                    if (authAllowed !== true) {
                      throw('Read operation denied');
                    } else {
                      return record;
                    }
                  });
                } else {
                  return record;
                }
              }).then(function (records) {
                if (id) {
                  if (records.length !== 1) {
                    throw('Record with specified id not found');
                  } else {
                    var record = records[0];
                    models[model] = record.value;
                    return models;
                  }
                } else {
                  models[model] = records.map(function (record) {
                    return record.value;
                  });
                  return models;
                }
              }).then((options.loadDependencies !== false) ? loadDependencies(db) : null).then(JSON.stringify).then(function (encodedModels) {
                response.writeHead(200);
                response.end(encodedModels);
              });
          }
        }
      })
    /*.catch(function (err) {
     console.error(err);
     response.writeHead(422);
     response.end(JSON.stringify({
     errors: [err]
     }));
     });*/
  }
};
