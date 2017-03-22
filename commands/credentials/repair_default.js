'use strict'

const co = require('co')
const cli = require('heroku-cli-util')

function * run (context, heroku) {
  const fetcher = require('../../lib/fetcher')(heroku)
  const host = require('../../lib/host')

  const {app, args} = context

  let db = yield fetcher.addon(app, args.database)

  yield cli.action(`Resetting permissions for default role to factory settings`, co(function * () {
    yield heroku.post(`/postgres/v0/databases/${db.name}/credentials/repair-default`, {host: host(db)})
  }))
}

module.exports = {
  topic: 'pg',
  command: 'credentials:repair-default',
  description: 'Repair the permissions of the default role within database.',
  needsApp: true,
  needsAuth: true,
  help: `
Example Usage:
  heroku pg:credentials:repair-default postgresql-something-12345 --name my_role
`,
  args: [{name: 'database', optional: true}],
  run: cli.command({preauth: true}, co.wrap(run))
}
