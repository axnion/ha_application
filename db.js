const cassandra   = require('cassandra-driver')
const config      = require('./config.js')
const db_version  = require('./db_version.js')

// TODO: Add exception handling so it crashes if something happends
// TODO: Add moving of data between old and new table
// TODO: New table is used
// TODO: Add stuff to be done depending on version
function init() {
  executeRisky(getInitClient(), "CREATE KEYSPACE IF NOT EXISTS inventory WITH REPLICATION = { 'class': 'SimpleStrategy', 'replication_factor' : 3 }")
  .then(function() {
    return executeRisky(getClient(), "CREATE TABLE IF NOT EXISTS version ( id uuid PRIMARY KEY, table_name text, cur_version int, pre_version int )")
  })
  .then(function() {
    return executeRisky(getClient(), "SELECT * FROM version WHERE table_name='item' ALLOW FILTERING")
  })
  .then(function(results) {
    console.log(results.info)
    if (results.rowLength == 0) {
      id = cassandra.types.Uuid.random()
      return executeRisky(getClient(), "INSERT INTO version (id, table_name, cur_version, pre_version) VALUES (" + id + ", 'item', 0, 0)")
    } else {
      return doNothing()
    }
  })
  .then(function() {
    return executeRisky(getClient(), "SELECT * FROM version WHERE table_name='item' ALLOW FILTERING")
  })
  .then(function(results) {
    const id = results.rows[0].id
    const cur_version = results.rows[0].cur_version

    if (cur_version < db_version) {
      return executeRisky(getClient(), "UPDATE version SET cur_version = " + db_version + ", pre_version = " + cur_version + " WHERE id = " + id )
      .then(function() {
        return executeRisky(getClient(), "CREATE TABL IF NOT EXISTS item_v" + db_version + " ( id uuid PRIMARY KEY, name text )")
      })
    } else {
      return doNothing()
    }
  })
}

function add(item) {
  item.id = cassandra.types.Uuid.random()
  return execute(getClient(), "INSERT INTO item" + db_version + " (id, name) VALUES (" + item.id +"," + item.name + ")")
}

function get() {
  return execute(getClient(), "SELECT * FROM item;")
}

function getById(id) {
  return execute(getClient(), "SELECT * FROM item WHERE id = " + id + ";")
}

function update(item) {
  return execute(getClient(), "UPDATE item SET name = '" + item.name + "' WHERE id = " + item.id + ";")
}

function remove(id) {
  return execute(getClient(), "DELETE FROM item WHERE id = " + id + ";")
}

function test() {
  return execute(getClient(), 'SELECT * FROM system.local')
}

function executeRisky(client, query) {
  return client.connect()
    .then(function() {
      console.log("executing: " + query)
      return client.execute(query)
    })
    .then(function(results) {
      console.log("done")
      client.shutdown(results)
      return new Promise(function(resolve, reject) {
        resolve(results)
      })
    })
    .catch(function(err) {
      console.log("error: " + err)
      return client.shutdown()
      .then(function() {
        process.exit(1)
      })
    })
}

function execute(client, query) {
  return client.connect()
    .then(function() {
      console.log("executing: " + query)
      return client.execute(query)
    })
    .then(function(results) {
      console.log("done")
      client.shutdown(results)
      return new Promise(function(resolve, reject) {
        resolve(results)
      })
    })
    .catch(function(err) {
      console.log("error: " + err)
      return client.shutdown()
    })
}


function getClient() {
  return new cassandra.Client({
    contactPoints: config.db.contactPoints,
    keyspace: config.db.keyspace,
    authProvider: new cassandra.auth.PlainTextAuthProvider(config.db.user, config.db.pass)
  })
}

function getInitClient() {
  return new cassandra.Client({
    contactPoints: config.db.contactPoints,
    authProvider: new cassandra.auth.PlainTextAuthProvider(config.db.user, config.db.pass)
  })
}

function doNothing() {
  return Promise.resolve("Doing nothing")
}

module.exports = {
  init:     init,
  add:      add,
  get:      get,
  getById:  getById,
  update:   update,
  remove:   remove,
  test:     test
}
