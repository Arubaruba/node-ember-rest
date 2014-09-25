var url = require('url');
var crypto = require('crypto');
var async = require('async');
var actions = require('./actions');
var util = require('../util');

function denyAction(response, action, model) {
  return function () {
    response.writeHead(403);
    response.end("You are unauthorized to " + action + " the model \"" + model.singular + "\"");
  }
}

function databaseError(response, err) {
  if (err.name == 'notFoundError') {
    response.writeHead(404);
    response.end('Database record not found');
  } else {
    response.writeHead(500);
    response.end('Server encountered database error');
  }
}

module.exports = function (options) {

  var keyLength = 10;

  return function (modelSingular, modelPlural, authRead, authWrite) {
    var model = {singular: modelSingular, plural: modelPlural};

    options.route.handle('/' + model.plural, function (request, response, session, router) {
      var db = session.db;
      if (request.method == 'POST') {
        async.waterfall([
          // Receive the model data, and authenticate it
          function (callback) {
            util.receiveData(request, response, function (data) {
              var modelContents = data[model.singular];
              if (modelContents) {
                authWrite(request, response, session, {
                  name: model,
                  newData: modelContents,
                  allow: function () {
                    callback(null, data);
                  },
                  deny: function () {
                    callback(true);
                    denyAction(response, 'create', model)();
                  }
                });
              } else {
                callback(true);
                response.writeHead(400);
                response.end('JSON does not contain name of created model');
              }
            });
          },
          // Make sure that it is not overwriting a record if an id is supplied
          // if an id is not supplied, generate one
          function (data, callback) {
            var id = data[model.singular].id;
            if (id) {
              db.get(model.plural + '/' + id, function (err) {
                if (err) {
                  if (err.name = 'notFoundError') {
                    callback(null, data, id);
                  } else {
                    callback(true);
                    response.writeHead(500);
                    response.end('Server could not access database');
                  }
                } else {
                  callback(true);
                  response.writeHead(400);
                  response.end('Record already exists; Create will not update existing records');
                }
              });
            } else {
              crypto.randomBytes(keyLength, function (err, bytes) {
                callback(null, data, bytes.toString('base64').replace(/\W/g, ''));
              });
            }
          },
          // Add the model to the database
          function (data, id) {
            data[model.singular].id = id;
            db.put(model.plural + '/' + id, data[model.singular], function (err) {
              if (err) {
                callback(true);
                response.writeHead(500);
                response.end('Server unable to write to database');
              } else {
                util.sendData(response, data);
              }
            });
          }
        ]);
      } else if (request.method == 'GET') {
        db.find(model.plural, router.query, function (err, results) {
          if (err) {
            if (err.name == 'notFoundError') {
              var send = {};
              send[model.plural] = [];
              util.sendData(response, send);
            } else {
              databaseError(response, err);
            }
          } else {
            async.every(results, function (result, callback) {
              authRead(request, response, session, {
                name: model,
                data: result,
                allow: function () {
                  callback(true);
                },
                deny: function () {
                  callback(false);
                }
              });
            }, function (truthValue) {
              if (truthValue) {
                var send = {};
                send[model.plural] = results.map(function (item) {
                  return item.value;
                });
                util.sendData(response, send);
              } else {
                denyAction(response, 'find', model)();
              }
            });
          }
        });
      } else {
        response.writeHead(405);
        response.end('Invalid Method: ' + request.method);
      }
    });

    options.route.handle('/' + model.plural + '/:id', function (request, response, session, router) {
      var db = session.db;
      var id = router.dynamicSegements.id,
        key = model.plural + '/' + id;

      db.find(key, router.query, function (err, results) {
        if (err) {
          databaseError(response, err);
        } else {
          var data = results[0].value;
          if (request.method == 'PUT') {
            util.receiveData(request, response, function (recievedData) {
              var newData = recievedData[model.singular];
              newData.id = id;
              authWrite(request, response, session, {
                name: model,
                data: data,
                newData: newData,
                allow: function () {
                  db.put(key, newData, function (err) {
                    if (err) {
                      databaseError(response, err);
                    } else {
                      util.sendData(response, recievedData);
                    }
                  });
                },
                deny: denyAction(response, 'update', model)
              });
            });
          } else if (request.method == 'GET') {
            authRead(request, response, session, {
              name: model,
              data: data,
              allow: function () {
                var send = {};
                send[model.singular] = data;
                util.sendData(response, send);
              },
              deny: denyAction(response, 'find', model)
            });
          } else if (request.method == 'DELETE') {
            authWrite(request, response, session, {
              name: model,
              data: data,
              newData: null,
              allow: function () {
                db.del(key, function (err) {
                  if (err) {
                    databaseError(response, err);
                  } else {
                    util.sendData(response, {});
                  }
                });
              },
              deny: denyAction(response, 'delete', model)
            });
          } else {
            response.writeHead(405);
            response.end('Invalid Method: ' + request.method);
          }
        }
      });
    });
  }
};
