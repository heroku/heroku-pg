'use strict'

const co = require('co')
const cli = require('heroku-cli-util')

function * run (context, heroku) {
  const fetcher = require('../lib/fetcher')(heroku)

  const {app, args, flags} = context

  let showCredentials = co.wrap(function * () {
    const host = require('../lib/host')
    let addon = yield fetcher.addon(app, args.database)
    let credentials = yield heroku.get(`/postgres/v0/databases/${addon.name}/credentials`,
                                       { host: host(db) })
    if no errors
      cli.table(credentials, {
        columns: [
          {key: 'name', label: 'Credential'},
          {key: 'state', label: 'State'}
        ]
      })
    else
      let db = yield fetcher.database(app, args.database)
      cli.log(`Connection info string:
     "dbname=${db.database} host=${db.host} port=${db.port || 5432} user=${db.user} password=${db.password} sslmode=require"
  Connection URL:
     ${db.url.href}`)
    end
  })

  let reset = co.wrap(function * () {
    const host = require('../lib/host')
    let db = yield fetcher.addon(app, args.database)
    yield cli.action(`Resetting credentials on ${cli.color.addon(db.name)}`, co(function * () {
      yield heroku.post(`/client/v11/databases/${db.id}/credentials_rotation`, {host: host(db)})
    }))
  })

  if (flags.reset) {
    yield reset()
  } else {
    yield showCredentials()
  }
}

module.exports = {
  topic: 'pg',
  command: 'credentials',
  description: 'manage the database credentials',
  needsApp: true,
  needsAuth: true,
  flags: [{name: 'reset', description: 'reset database credentials'}],
  args: [{name: 'database', optional: true}],
  run: cli.command({preauth: true}, co.wrap(run))
}
