'use strict'

const cli = require('heroku-cli-util')
const co = require('co')

function * run (context, heroku) {
  const host = require('../../lib/host')
  const fetcher = require('../../lib/fetcher')(heroku)
  let {app, args, flags} = context

  const db = yield fetcher.addon(app, args.database)

  yield cli.confirmApp(app, flags.confirm, `WARNING: Destructive action
This command will affect the database ${cli.color.addon(db.name)}
This will delete ${cli.color.cyan(args.link)} along with the tables and views created within it.
This may have adverse effects for software written against the ${cli.color.cyan(args.link)} schema.
`)
  yield cli.action(`Destroying link ${cli.color.cyan(args.link)} from ${cli.color.addon(db.name)}`, co(function * () {
    yield heroku.delete(`/client/v11/databases/${db.id}/links/${encodeURIComponent(args.link)}`, {host: host(db)})
  }))
}

module.exports = {
  topic: 'pg',
  command: 'links:destroy',
  description: 'destroys a link between data stores',
  help: `Example:
  heroku pg:links:destroy HEROKU_POSTGRESQL_CERULEAN redis-symmetrical-100`,
  needsApp: true,
  needsAuth: true,
  args: [{name: 'database'}, {name: 'link'}],
  flags: [{name: 'confirm', char: 'c', hasValue: true}],
  run: cli.command({preauth: true}, co.wrap(run))
}
