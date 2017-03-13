'use strict'

const co = require('co')
const cli = require('heroku-cli-util')

function * run (context, heroku) {
  const fetcher = require('../../lib/fetcher')(heroku)
  const host = require('../../lib/host')

  const {app, args, flags} = context

  let db = yield fetcher.addon(app, args.database)

  if (flags.name) {
    let data = {
      name: flags.name
    }
    yield cli.action(`Creating credential ${cli.color.cmd(flags.name)}`, co(function * () {
      yield heroku.post(`/postgres/v0/databases/${db.name}/credentials`, {host: host(db), body: data})
    }))
  } else {
    throw new Error(`Error: Please specify a name for the new credential.`)
  }
}

module.exports = {
  topic: 'pg',
  command: 'credentials:create',
  description: 'Create role within database.',
  needsApp: true,
  needsAuth: true,
  help: `
HELP STUFF
`,
  args: [{name: 'database', optional: true}],
  flags: [{name: 'name', hasValue: true, description: "name of the new credential within the database"}],
  run: cli.command({preauth: true}, co.wrap(run))
}
