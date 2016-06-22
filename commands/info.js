'use strict'

const co = require('co')
const cli = require('heroku-cli-util')

function configVarNamesFromValue (config, value) {
  const sortBy = require('lodash.sortby')

  let keys = []
  for (let key of Object.keys(config)) {
    if (config[key] === value) keys.push(key)
  }
  return sortBy(keys, k => k !== 'DATABASE_URL', 'name')
}

function databaseNameFromUrl (uri, config) {
  const invert = require('lodash.invert')
  const url = require('url')

  delete config.DATABASE_URL
  let name = invert(config)[uri]
  if (name) return name.replace(/_URL$/, '')
  uri = url.parse(uri)
  return `${uri.hostname}:${uri.port || 5432}${uri.path}`
}

function displayDB (db) {
  cli.styledHeader(db.configVars.map(c => cli.color.configVar(c)).join(', '))
  db.db.info.push({name: 'Add-on', values: [db.addon.name]})
  let info = db.db.info.reduce((info, i) => {
    if (i.values.length > 0) {
      info[i.name] = i.resolve_db_name ? databaseNameFromUrl(i.values[0], db.config) : i.values.join(', ')
    }
    return info
  }, {})
  let keys = db.db.info.map(i => i.name)
  cli.styledObject(info, keys)
  cli.log()
}

function * run (context) {
  const sortBy = require('lodash.sortby')
  const host = require('../lib/host')
  const fetcher = require('../lib/fetcher')
  const app = context.app
  const db = context.args.database

  let addons = []
  let config = cli.heroku.get(`/apps/${app}/config-vars`)

  if (db) {
    addons = yield [fetcher.addon(app, db)]
  } else {
    addons = yield fetcher.all(app)
    if (addons.length === 0) {
      cli.log(`${cli.color.app(app)} has no heroku-postgresql databases.`)
      return
    }
  }

  let dbs = yield addons.map(addon => {
    return {
      addon,
      config,
      db: cli.heroku.request({
        host: host(addon),
        method: 'get',
        path: `/client/v11/databases/${addon.name}`
      })
    }
  })

  dbs.forEach(db => { db.configVars = configVarNamesFromValue(db.config, db.db.resource_url) })
  dbs = sortBy(dbs, db => db.configVars[0] !== 'DATABASE_URL', 'configVars[0]')

  dbs.forEach(displayDB)
}

let cmd = {
  topic: '_pg',
  needsApp: true,
  needsAuth: true,
  args: [{name: 'database', optional: true}],
  run: cli.command({preauth: true}, co.wrap(run))
}

exports.displayDB = displayDB
exports.root = cmd
exports.info = Object.assign({}, cmd, {command: 'info'})
