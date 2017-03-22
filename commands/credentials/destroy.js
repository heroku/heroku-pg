'use strict'

const co = require('co')
const cli = require('heroku-cli-util')

function * run (context, heroku) {
  const fetcher = require('../../lib/fetcher')(heroku)
  const host = require('../../lib/host')

  const {app, args, flags} = context
  let cred = flags.name

  let db = yield fetcher.addon(app, args.database)

  yield cli.confirmApp(app, flags.confirm, `WARNING: Destructive action`)

  yield cli.action(`Destroying credential ${cli.color.cmd(cred)}`, co(function * () {
    yield heroku.delete(`/postgres/v0/databases/${db.name}/credentials/${cred}`, {host: host(db)})
  }))

  cli.log(`The credential has been destroyed within ${db.name} and detached from all apps.`)
  cli.log(`Database objects owned by ${cred} will be assigned to the default credential`)
}

module.exports = {
  topic: 'pg',
  command: 'credentials:destroy',
  description: 'destroy role within database',
  needsApp: true,
  needsAuth: true,
  help: `
Example Usage:
  heroku pg:credentials:destroy postgresql-something-12345 --name role_to_destroy
`,
  args: [{name: 'database', optional: true}],
  flags: [
    {name: 'name', hasValue: true, required: true, description: 'name of credential to destroy'},
    {name: 'confirm', char: 'c', hasValue: false}
  ],
  run: cli.command({preauth: true}, co.wrap(run))
}