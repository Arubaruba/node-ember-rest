var crypto = require('crypto');
var util = require('../util');

exports.find = function (request, response, db, model, query, segmentCount, callback) {

  function error (code, message) {
    response.writeHead(code);
    response.end(JSON.stringify({error: message}));
  }

  db.find(model, query, function (err, results) {
    if (err) {
      if (err.type == 'notFoundError') {
        error(400, 'COULD_NOT_FIND_RECORD');
      } else {
        error(500, 'COULD_NOT_READ_DATABASE');
      }
    } else {
      if (segmentCount == 2) {
        sendData(response, results[0].value)
      } else {
        var resultList = results.reduce(function (previous, result) {
          previous[result.key] = result.data;
        }, {});
        sendData(response, resultList);
      }
    }
  });
};

exports.create = function (request, response, db, model, keyLength) {

  function createRecord(id, data) {
    db.put(model.plural + '/' + id, data, function (err) {
      if (err) {
        console.error(err);
        response.writeHead(500);
        response.end('UNABLE_TO_WRITE_TO_DATABASE');
      } else {
        response.writeHead(200);
        data[model.singular].id = id;
        response.write(JSON.stringify(data));
        console.log(data);
        response.end();
      }
    });
  }

  util.receiveData(request, response, function (data) {
    var id = (data[model.singular]) ? data[model.singular].id : null;
    if (id) {
      // if the optional id value is given, we must check if the record already exists
      db.get(model.plural + '/' + id, function (err) {
        if (err) {
          if (err.name = 'notFoundError') {
            delete data.id;
            createRecord(id, data);
          } else {
            response.writeHead(500);
            response.end('DATABASE_ERROR');
          }
        } else {
          response.writeHead(400);
          response.end('RECORD_ALREADY_EXISTS');
        }
      });
    } else {
      crypto.randomBytes(keyLength, function (err, bytes) {
        if (err) throw(err);
        id = bytes.toString('base64').replace(/\W/g, '');
        createRecord(id, data);
      });
    }
  });
};

exports.update = function (request, response, db, model, id) {
  var key = model.plural + '/' + id;
  db.get(key, function (err) {
    if (err) {
      if (err.type == 'notFoundError') {
        response.writeHead(400);
        response.end('UNABLE_TO_FIND_EXISTING_RECORD');
      } else {
        response.writeHead(500);
        response.end('COULD_NOT_READ_DATABASE');
      }
    } else {
      util.receiveData(request, response, function (data) {
        data.id = id;
        db.put(key, data, function (err) {
          if (err) {
            response.writeHead(500);
            response.end('COULD_NOT_WRITE_TO_DATABASE');
          } else {
            response.writeHead(200);
            response.write(JSON.stringify(data));
            response.end('DATA_SUCCESSFULLY_WRITTEN');
          }
        });
      });
    }
  });
};

//exports.remove = function (request, response, db, model) {
//  db.del(model, function (err) {
//    if (err) {
//      if (err.type == 'notFoundError') {
//        response.writeHead(400);
//        response.end('COULD_NOT_FIND_RECORD');
//      } else {
//        response.writeHead(500);
//        response.end('DATABASE_COULD_NOT_DELETE_RECORD');
//      }
//    }
//  });
//};
