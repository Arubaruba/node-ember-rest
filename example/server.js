var http = require('http');
var rest = require('../index');
var levelup = require('levelup');
var url = require('url');
var fs = require('fs');

var port = 7414;
var staticDir = '/static';
var restNamespace = '/data';

var server = http.createServer(function (request, response) {
  var path = url.parse(request.url).pathname;

  // Serve static files
  if (path.indexOf(staticDir) == 0) {
    var dir = path.substring(staticDir.length);
    fs.readFile(__dirname + dir, {encoding: 'utf8'}, function (err, file) {
      if (err) {
        response.writeHead(404);
        response.end('Invalid static url: ' + path);
      } else {
        response.writeHead(200);
        response.end(file);
      }
    });

    // Serve REST Data
  } else if (path.indexOf(restNamespace) == 0) {
    emberData(request, response, {
      comments: {
        read: true,
        write: true
      },
      tags: {
        read: true,
        write: true
      }
    });
  } else if (path.indexOf('/socket.io') == 0) {
    // let socket.io handle it
  } else {
    response.writeHead(404);
    response.end('Invalid url: ' + path);
  }
}).listen(port);

var emberData = rest({
  namespace: restNamespace,
  levelup: levelup('./levelup-data', {valueEncoding: 'json'}),
  socketServer: server
});
