'use strict'

const co = require('co')
const execa = require('execa')
const os = require('os')
const cli = require('heroku-cli-util')
const fetcher = require('./fetcher')

function * exec (heroku, query, database, app) {
  let db = yield fetcher.databaseURL(heroku, database, app)
  let [user, password] = db.auth.split(':')
  let env = {
    PGAPPNAME: 'psql non-interactive',
    PGUSER: user,
    PGPASSWORD: password,
    PGDATABASE: db.path.split('/', 2)[1],
    PGPORT: db.port,
    PGHOST: db.hostname
  }
  let cmd = 'psql'
  let args = ['-c', query]
  if (os.platform() !== 'win32') {
    args.unshift(cmd)
    cmd = 'command'
  }
  try {
    let {stdout, stderr} = yield execa(cmd, args, {env})
    process.stderr.write(stderr)
    return stdout
  } catch (err) {
    if (err.code !== 127) throw err
    cli.error(`The local psql command could not be located.
For help installing psql, see https://devcenter.heroku.com/articles/heroku-postgresql#local-setup`)
    process.exit(127)
  }
}

module.exports = {
  exec: co.wrap(exec)
}
