var crypto = require('crypto');

crypto.randomBytes(10, function(err, bytes) {
  console.log(bytes.toString('base64'));
});