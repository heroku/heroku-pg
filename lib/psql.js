'use strict'

const co = require('co')
const debug = require('debug')('psql')
const tunnel = require('tunnel-ssh')

function handleError (err) {
  const cli = require('heroku-cli-util')
  if (!err) return
  if (err.code !== 'ENOENT') throw err
  cli.error(`The local psql command could not be located.
For help installing psql, see https://devcenter.heroku.com/articles/heroku-postgresql#local-setup`)
  process.exit(1)
}

function env (db) {
  let env = Object.assign({}, process.env, {
    PGAPPNAME: 'psql non-interactive',
    PGSSLMODE: db.hostname === 'localhost' ? 'prefer' : 'require',
    PGUSER: db.user || '',
    PGPASSWORD: db.password,
    PGDATABASE: db.database,
    PGPORT: db.port || 5432,
    PGHOST: db.host
  })
  if (db.bastionKey) {
    env = Object.assign(env, {
      PGPORT: tunnelConfig(db).localPort,
      PGHOST: tunnelConfig(db).localHost,
    })
  }
  return env
}

function tunnelConfig(db) {
  const localHost = '127.0.0.1'
  const localPort = Math.floor(Math.random() * (65535 - 49152) + 49152)
  return {
    username: 'bastion',
    host: db.bastionHost,
    privateKey: db.bastionKey,
    dstHost: db.host,
    dstPort: db.port,
    localHost: localHost,
    localPort: localPort
  }
}

function handleSignals () {
  process.once('SIGINT', () => {})
}

function * exec (db, query) {
  const stripEOF = require('strip-eof')
  const {spawnSync} = require('child_process')
  handleSignals()
  debug(query)

  const tunnelPromise = new Promise((resolve, reject) => {
    // if necessary to tunnel, setup a tunnel
    // see also https://github.com/heroku/heroku/blob/master/lib/heroku/helpers/heroku_postgresql.rb#L53-L80
    if (db.bastionKey) {
      const tunnelConfig = tunnelConfig(db)
      tunnel(tunnelConfig, (err, tnl) => {
        if (err) {
          debug(err)
          cli.error(`Unable to establish a secure tunnel to your database.`)
          process.exit(1)
        }
        debug('Tunnel created')
        resolve(tnl)
      })
    } else {
      resolve()
    }
  })

  const command = tunnelPromise.then((tnl) => {
    return new Promise((resolve, reject) => {
      let psql = spawn('psql', ['-c', query], {env(db), encoding: 'utf8'})
      psql.stdout.on('data', (data) => (resolve(stripEOF(data))))
      psql.stderr.on('data', (data) => {
        debug(err)
        cli.error(`Unable to execute the command.`)
        process.exit(1)
      })
      psql.on('error', (err) => {
        debug(err)
        handleError(err)
      })
    })
  })
}

function * interactive (db) {
  const {spawnSync} = require('child_process')
  const pgUtil = require('./util')
  let name = pgUtil.getUrl(db.attachment.config_vars).replace(/^HEROKU_POSTGRESQL_/, '').replace(/_URL$/, '')
  let prompt = `${db.attachment.app.name}::${name}%R%# `
  handleSignals()
  let {error: err, status} = spawnSync('psql',
    ['--set', `PROMPT1=${prompt}`, '--set', `PROMPT2=${prompt}`],
    {env: env(db), stdio: 'inherit'})
  handleError(err)
  if (status !== 0) process.exit(status)
}

module.exports = {
  exec: co.wrap(exec),
  interactive: co.wrap(interactive)
}
