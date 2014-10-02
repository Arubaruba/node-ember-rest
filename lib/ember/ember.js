var url = require('url');
var crypto = require('crypto');
var async = require('async');
var actions = require('./actions');
var util = require('../util');

var models = [];

var EmberDataUtils = function (request, response, session, model) {
  var db = session.db;

  function errorResponse(err) {
    if (typeof(err) != 'object') {
      throw('Ember Data Errors must be Objects with Strings as Properties');
    } else {
      var propertyNames = Object.keys(err);
      for (var i = 0; i < propertyNames.length; i++) {
        var property = err[propertyNames[i]];
        if (!Array.isArray(property)) err[propertyNames[i]] = [property];
      }
    }

    response.writeHead(422);
    response.end(JSON.stringify({'errors': err}));
    console.log(JSON.stringify({'errors': err}));
  }

  function databaseError(err) {
    if (err.name = 'notFoundError') {
      errorResponse({Database: 'could not find Records'})
    } else {
      errorResponse({Database: 'unexpected Error'});
    }
  }

  function authAction(auth, data, newData, action, onAllow) {
    var errorResponseBody = {};
    errorResponseBody[model.plural] = action + ' unauthorized';

    if (auth) {
      auth(request, response, session, {
        name: model,
        data: data,
        newData: newData,
        allow: onAllow,
        deny: function (reason) {
          if (!reason) {
            errorResponse(errorResponseBody);
          } else {
            errorResponse(reason);
          }
        }
      });
    } else {
      errorResponse(errorResponseBody);
    }
  }

  function loadDependencies(data, finalCallback) {

    function validId(value) {
      return value.substring(value.length - 2, value.length) == '==';
    }

    function load(model, callback) {
      // get ids required by the model
      var ids = [];
      Object.keys(model).forEach(function (key) {
        var value = model[key];
        if (typeof(value) == 'string' && validId(value) && key != 'id') {
          ids.push(value);
        } else if (value instanceof Array && typeof(value[0]) == 'string' && validId(value[0])) {
          ids = ids.concat(value);
        }
      });
      // load ids
      if (ids.length > 0) {
        var id = ids[0];
        db.find(new RegExp(id + '$'), {}, function (err, records) {
          if (err) {
            callback();
          } else {
            var record = records[0];
            if (!data[record.value.id]) {
              var modelName = record.key.split('/')[0];
              if (!data[modelName]) data[modelName] = [];
              data[modelName].push(record.value);
//              load(record.value, callback);
            }
            callback();
          }
        });
      }
//        async.parallel(
//          ids.map(function (id) {
//            return function (callback) {
//              db.find(new RegExp(id + '$'), {}, function (err, records) {
//                if (err) {
//                  callback();
//                } else {
//                  var record = records[0];
//                  if (!data[record.value.id]) {
//                    var modelName = record.key.split('/')[0];
//                    if (!data[modelName]) data[modelName] = [];
//                    data[modelName].push(record.value);
////                    load(record.value, callback);
//                  }
//                  callback();
//                }
//              });
//            };
//          }), function () {
//            callback();
//            console.log('done loading');
//          }
//        );
//      }
    }

    if (data instanceof Array) {
      load(data[0], function () {
        finalCallback();
        console.log('done!');
      });
//      async.parallel(data.map(function (model) {
//        return function (callback) {
//          load(model, function() {
//            callback();
//          });
//        }
//      }), function() {
//        finalCallback();
//        console.log('done!');
//      });
    } else {
      load(data, finalCallback);
    }
  }

  this.errorResponse = errorResponse;
  this.databaseError = databaseError;
  this.authAction = authAction;
  this.loadDependencies = loadDependencies;
};

exports.handleRoute = function (route, options) {
  if (!options.keyLength) options.keyLength = 10;

  return function (model) {
    models.push(model);
    route.handle('/' + model.plural, function (request, response, session, router) {
      var emberDataUtils = new EmberDataUtils(request, response, session, model);
      var db = session.db;
      if (request.method == 'POST') {
        async.waterfall([
          // Receive the model data, and authenticate it
          function (callback) {
            util.receiveData(request, response, function (receivedData) {
              var newData = receivedData[model.singular];
              if (newData) {
                emberDataUtils.authAction(model.write, null, newData, 'create', function () {
                  callback(null, newData);
                });
              } else {
                callback(true);
                emberDataUtils.errorResponse({'JSON': 'Must contain singular model name'});
              }
            });
          },
          // Make sure that it is not overwriting a record if an id is supplied
          // if an id is not supplied, generate one
          function (newData, callback) {
            var id = newData.id;
            if (id) {
              db.get(model.plural + '/' + id, function (err) {
                if (err) {
                  if (err.name = 'notFoundError') {
                    callback(null, newData, id);
                  } else {
                    callback(true);
                    emberDataUtils.databaseError(err);
                  }
                } else {
                  callback(true);
                  emberDataUtils.errorResponse({'Database': 'create should not override existing Records'});
                }
              });
            } else {
              crypto.randomBytes(options.keyLength, function (err, bytes) {
                callback(null, newData, bytes.toString('base64'));
              });
            }
          },
          // Add the model to the newDatabase
          function (newData, id) {
            newData.id = id;
            db.put(model.plural + '/' + id, newData, function (err) {
              if (err) {
                callback(true);
                emberDataUtils.databaseError(err);
              } else {
                var send = {};
                send[model.singular] = newData;
                util.sendData(response, send);
              }
            });
          }
        ]);
      } else if (request.method == 'GET') {
        db.find(new RegExp('^' + model.plural), router.query, function (err, results) {
          if (err) {
            if (err.name == 'notFoundError') {
              var send = {};
              send[model.plural] = [];
              util.sendData(response, send);
            } else {
              emberDataUtils.databaseError(err);
            }
          } else {
            async.every(results, function (result, callback) {
              emberDataUtils.authAction(model.read, result.value, null, 'find', function () {
                callback(true);
              });
            }, function (truthValue) {
              if (truthValue) {
                var send = {};
                var values = results.map(function (item) {
                  return item.value;
                });
                send[model.plural] = values;

                emberDataUtils.loadDependencies(values, function () {
                  util.sendData(response, send);
                });
//                  util.sendData(response, send);

              } else {
                var error = {};
                error[model.plural] = 'find unauthorized';
                emberDataUtils.errorResponse(error);
              }
            });
          }
        });
      } else {
        emberDataUtils.errorResponse({'Http': 'Invalid Method'});
      }
    });

    route.handle('/' + model.plural + '/:id', function (request, response, session, router) {
      var emberDataUtils = new EmberDataUtils(request, response, session, model),
        db = session.db,
        id = router.dynamicSegements.id,
        key = model.plural + '/' + id;

      db.get(key, function (err, data) {
        if (err) {
          emberDataUtils.databaseError(err);
        } else {
          if (request.method == 'PUT') {
            util.receiveData(request, response, function (receivedData) {
              var newData = receivedData[model.singular];
              newData.id = id;
              emberDataUtils.authAction(model.write, data, newData, 'update', function () {
                db.put(key, newData, function (err) {
                  if (err) {
                    emberDataUtils.databaseError(err);
                  } else {
                    util.sendData(response, receivedData);
                  }
                });
              });
            });
          } else if (request.method == 'GET') {
            emberDataUtils.authAction(model.read, data, null, 'find', function () {
              var send = {};
              send[model.singular] = data;
              util.sendData(response, send);
            });
          } else if (request.method == 'DELETE') {
            emberDataUtils.authAction(model.write, data, null, 'delete', function () {
              db.del(key, function (err) {
                if (err) {
                  emberDataUtils.databaseError(err);
                } else {
                  util.sendData(response, {});
                }
              });
            });
          } else {
            emberDataUtils.errorResponse({'Http': 'Invalid Method'});
          }
        }
      });
    });
  }
};
