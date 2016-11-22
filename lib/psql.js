'use strict'

const co = require('co')
const debug = require('debug')('psql')
const tunnel = require('tunnel-ssh')
const cli = require('heroku-cli-util')

function env (db) {
  return Object.assign({}, process.env, {
    PGAPPNAME: 'psql non-interactive',
    PGSSLMODE: db.hostname === 'localhost' ? 'prefer' : 'require',
    PGUSER: db.user || '',
    PGPASSWORD: db.password,
    PGDATABASE: db.database,
    PGPORT: db.port || 5432,
    PGHOST: db.host
  })
}

function tunnelConfig (db) {
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

function buildTunnelPromise (db, dbTunnelConfig, timeout) {
  return new Promise((resolve, reject) => {
    // if necessary to tunnel, setup a tunnel
    // see also https://github.com/heroku/heroku/blob/master/lib/heroku/helpers/heroku_postgresql.rb#L53-L80
    if (db.bastionKey) {
      tunnel(dbTunnelConfig, (err, tnl) => {
        if (err) {
          debug(err)
          reject(`Unable to establish a secure tunnel to your database.`)
        }
        debug('Tunnel created')
        resolve(tnl)
      })
    } else {
      resolve()
    }
    setTimeout(() => reject('Establishing a secure tunnel timed out'), timeout)
  })
}

function buildPsqlPromise (query, dbEnv, timeout) {
  const {spawn} = require('child_process')
  const stripEOF = require('strip-eof')
  return new Promise((resolve, reject) => {
    let psql = spawn('psql', ['-c', query], {env: dbEnv, encoding: 'utf8'})
    psql.stdout.on('data', (data) => {
      resolve(stripEOF(data))
    })
    psql.stderr.on('data', (data) => {
      console.log(data.toString('utf8'))
      debug(stripEOF(data.toString('utf8')))
      reject(`Unable to execute the command.`)
      process.exit(1)
    })
    psql.on('error', (err) => {
      if (err.code == 'ENOENT') {
        reject(`The local psql command could not be located. For help installing psql, see https://devcenter.heroku.com/articles/heroku-postgresql#local-setup`)
      } else {
        reject(err)
      }
    })
    setTimeout(() => reject('psql call timed out'), timeout)
  })
}

function buildPsqlInteractivePromise (dbEnv, prompt, timeout) {
  const {spawn} = require('child_process')
  return new Promise((resolve, reject) => {
    let psql = spawn('psql',
                     ['--set', `PROMPT1=${prompt}`, '--set', `PROMPT2=${prompt}`],
                     {env: dbEnv, stdio: 'inherit'})
    psql.on('error', (err) => {
      if (err.code == 'ENOENT') {
        reject(`The local psql command could not be located. For help installing psql, see https://devcenter.heroku.com/articles/heroku-postgresql#local-setup`)
      } else {
        reject(err)
      }
    })
    resolve()
  })
}

function getConfigs (db) {
  let dbEnv = env(db)
  const dbTunnelConfig = tunnelConfig(db)
  if (db.bastionKey) {
    dbEnv = Object.assign(dbEnv, {
      PGPORT: dbTunnelConfig.localPort,
      PGHOST: dbTunnelConfig.localHost
    })
  }
  return {
    dbEnv: dbEnv,
    dbTunnelConfig: dbTunnelConfig
  }
}

function handleSignals () {
  process.once('SIGINT', () => {})
}

function * exec (db, query, timeout = 20000) {
  handleSignals()
  let configs = getConfigs(db)

  const tunnelPromise = buildTunnelPromise(db, configs.dbTunnelConfig, timeout)
  const command = tunnelPromise.then((tnl) => {
    let psqlPromise = buildPsqlPromise(query, configs.dbEnv, timeout)
    return psqlPromise
  }).catch((error) => {
    cli.error(error)
  })

  return yield command
}

function * interactive (db) {
  const {spawnSync} = require('child_process')
  const pgUtil = require('./util')
  let name = pgUtil.getUrl(db.attachment.config_vars).replace(/^HEROKU_POSTGRESQL_/, '').replace(/_URL$/, '')
  let prompt = `${db.attachment.app.name}::${name}%R%# `
  handleSignals()
  let configs = getConfigs(db)

  const tunnelPromise = buildTunnelPromise(db, configs.dbTunnelConfig)
  const command = tunnelPromise.then((tnl) => {
    let psqlPromise = buildPsqlInteractivePromise(configs.dbEnv, prompt)
    return psqlPromise
  }).catch((error) => {
    cli.error(error)
    process.exit(1)
  })

  return yield command
}

module.exports = {
  exec: co.wrap(exec),
  interactive: co.wrap(interactive)
}
