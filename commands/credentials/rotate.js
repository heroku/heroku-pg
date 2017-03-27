'use strict'

const co = require('co')
const cli = require('heroku-cli-util')

function * run (context, heroku) {
  const host = require('../../lib/host')
  const fetcher = require('../../lib/fetcher')(heroku)
  const {app, args, flags} = context
  let db = yield fetcher.addon(app, args.database)
  let all = flags.all

  if (all && 'name' in flags) {
    cli.exit(1, 'cannot pass both --all and --name')
  }
  let cred = flags.name || 'default'

  yield cli.confirmApp(app, flags.confirm, `WARNING: Destructive action`)

  if (all) {
    yield cli.action(`Rotating all credentials on ${cli.color.addon(db.name)}`, co(function * () {
      yield heroku.post(`/postgres/v0/databases/${db.name}/credentials_rotation`,
                        { host: host(db) })
    }))
  } else {
    yield cli.action(`Rotating ${cred} on ${cli.color.addon(db.name)}`, co(function * () {
      yield heroku.post(`/postgres/v0/databases/${db.name}/credentials/${encodeURIComponent(cred)}/credentials_rotation`,
                        { host: host(db) })
    }))
  }
}

module.exports = {
  topic: 'pg',
  command: 'credentials:rotate',
  description: 'rotate the database credentials',
  needsApp: true,
  needsAuth: true,
  flags: [
    {name: 'name', description: 'which credentials to rotate (default credentials if not specified)', hasValue: true},
    {name: 'all', description: 'rotate all credentials', hasValue: false},
    {name: 'confirm', char: 'c', hasValue: true}
  ],
  args: [{name: 'database', optional: true}],
  run: cli.command({preauth: true}, co.wrap(run))
}
