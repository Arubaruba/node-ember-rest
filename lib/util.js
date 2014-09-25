var requestSizeLimit = 1024 * 1024 / 4;

exports.shallowCopy = function (object) {
  var copy = {};
  var propertyNames = Object.keys(object);
  for (var i = 0; i < propertyNames.length; i++) {
    var property = propertyNames[i];
    copy[property] = object[property];
  }
  return copy;
};

exports.arrayify = function (object) {
  if (typeof(object) == 'string') {
    object = [object];
  }
  return object;
};

exports.objectValues = function (object) {
  var keys = Object.keys(object);
  var values = [];
  for (var i = 0; i < keys.length; i++) {
    values.push(object[keys[i]]);
  }
  return values;
};

exports.receiveData = function (request, response, callback) {
  var data = '';

  request.on('data', function (chunk) {
    data += chunk;
    if (data.length > requestSizeLimit) {
      request.abort();
      response.writeHead(413);
      response.end();
    }
  });

  request.on('error', function (err) {
    console.error(err);
    response.writeHead(500);
    response.end('UNABLE_TO_READ_DATA');
  });

  request.on('close', function () {
    response.end();
  });

  request.on('end', function () {
    if (!data) {
      response.writeHead(400);
      response.end('NO_DATA_SUPPLIED_TO_DATABASE');
    } else {
      try {
        var dataObject = JSON.parse(data);
      } catch (err) {
        response.writeHead(400);
        response.end('INVALID_JSON');
      }
      if (dataObject) {
        callback(dataObject);
        console.log('Received: ' + data)
      }
    }
  });
};

exports.sendData = function (response, data) {
  try {
    var json = JSON.stringify(data);
    response.writeHead(200);
    response.end(json);
    console.log('Sent: ' + json)
  } catch (err) {
    if (response.ended) {
      response.writeHead(500);
      response.end('UNABLE_TO_CONVERT_DATA_TO_JSON');
    }
  }
};

exports.endsWith = function (string, suffix) {
  if (typeof(string) == 'string') {
    return (string.indexOf(suffix, string.length - suffix.length) !== -1);
  } else {
    return false;
  }
};
