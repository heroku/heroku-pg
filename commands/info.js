'use strict'

const co = require('co')
const cli = require('heroku-cli-util')

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
  cli.styledHeader(cli.color.attachment(db.addon.name))
  let info = db.info.info.reduce((info, i) => {
    if (i.values.length > 0) {
      info[i.name] = i.resolve_db_name ? databaseNameFromUrl(i.values[0], db.config) : i.values.join(', ')
    }
    return info
  }, {})
  info['Config Vars'] = db.addon.config_vars.map((c) => cli.color.configVar(c)).join(', ')
  let keys = ['Config Vars'].concat(db.info.info.map((i) => i.name))
  cli.styledObject(info, keys)
  cli.log()
}

function * run (context, heroku) {
  const host = require('../lib/host')
  const fetcher = require('../lib/fetcher')
  const app = context.app
  const db = context.args.database

  let addons = []
  let config = heroku.get(`/apps/${app}/config-vars`)

  if (db) {
    addons = yield [fetcher.addon(heroku, app, db)]
  } else {
    addons = yield fetcher.all(heroku, app)
    if (addons.length === 0) {
      cli.log(`${cli.color.app(app)} has no heroku-postgresql databases.`)
      return
    }
  }

  let dbs = yield addons.map((a) => {
    return {
      addon: a,
      config,
      info: heroku.request({
        host: host(a),
        method: 'get',
        path: `/client/v11/databases/${a.name}`
      })
    }
  })

  dbs.forEach(displayDB)
}

let cmd = {
  topic: 'pg',
  needsApp: true,
  needsAuth: true,
  args: [{name: 'database', optional: true}],
  run: cli.command({preauth: true}, co.wrap(run))
}

exports.displayDB = displayDB
exports.root = cmd
exports.info = Object.assign({}, cmd, {command: 'info'})
