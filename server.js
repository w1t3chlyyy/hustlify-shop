// Server entrypoint
const { startServer } = require('./index.js');

if (require.main === module) {
  startServer();
}

module.exports = require('./index.js');
