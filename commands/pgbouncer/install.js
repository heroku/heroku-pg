'use strict'

const cli = require('heroku-cli-util')
const co = require('co')

function * run (context, heroku) {
  const fetcher = require('../../lib/fetcher')(heroku)
  const host = require('../../lib/host')
  const util = require('../../lib/util')
  const {app, args} = context
  const db = yield fetcher.addon(app, args.database)

  if (util.starterPlan(db)) throw new Error('pg:pgbouncer:install is only available for production databases')

  let response = yield heroku.put(`/postgres/v0/databases/${db.id}/pgbouncer`, {host: host(db)})
  cli.action.done(response.message)
}

module.exports = {
  topic: 'pg',
  command: 'pgbouncer:install',
  description: 'install pgbouncer',
  needsApp: true,
  needsAuth: true,
  args: [{name: 'database', optional: true}],
  run: cli.command({preauth: true}, co.wrap(run))
}
