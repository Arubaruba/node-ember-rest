var http = require('http');
var core = require('node-core');
var db = require('node-db');
var ember = require('../../index').ember;

var port = 7414;

var model = ember({
  route: core.route.handle('/data*', function (request, response, session, router) {
    router.next(function () {
      response.end('Invalid path: ' + request.url);
    });
  })
});

model('comment', 'comments',
  function (request, response, session, model) {
    model.allow();
  },
  function (request, response, session, model) {
    model.allow();
  }
);

model('tag', 'tags',
  function (request, response, session, model) {
    model.allow();
  },
  function (request, response, session, model) {
    model.allow();
  }
);

core.route.handle('/dump', function (request, response, session, router) {
  var readStream = session.db.createReadStream();
  var data = [];
  readStream.on('data', function (chunk) {
    if (chunk.key.split('/')[0] != 'sessions')
      data.push(JSON.stringify(chunk.value));
  });
  readStream.on('end', function () {
    response.end(data.join('</br></br>'));
  });
});

core.init({port: port, db: db, staticRoot: __dirname}, function () {
  console.log('Test server running on port ' + port);
});
