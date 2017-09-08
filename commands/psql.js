'use strict'

const co = require('co')
const cli = require('heroku-cli-util')

function * run (context, heroku) {
  const fetcher = require('../lib/fetcher')(heroku)
  const psql = require('../lib/psql')

  const {app, args, flags} = context

  let namespace = flags.credential ? `credential:${flags.credential}` : null

  let db = yield fetcher.database(app, args.database, namespace)
  cli.console.error(`--> Connecting to ${cli.color.addon(db.attachment.addon.name)}`)
  if (flags.command) {
    process.stdout.write(yield psql.exec(db, flags.command))
  } else {
    yield psql.interactive(db)
  }
}

let cmd = {
  description: 'open a psql shell to the database',
  needsApp: true,
  needsAuth: true,
  flags: [
    {name: 'command', char: 'c', description: 'SQL command to run', hasValue: true},
    {name: 'credential', description: 'credential to use', hasValue: true}
  ],
  args: [{name: 'database', optional: true}],
  run: cli.command({preauth: true}, co.wrap(run)),
  help: `Example:

    $ heroku pg:psql --app murmuring-headland-14719
    --> Connecting to postgresql-square-1337
    psql (9.6.3, server 9.6.4)
    SSL connection (protocol: TLSv1.2, cipher: ECDHE-RSA-AES256-GCM-SHA384, bits: 256, compression: off)
    Type "help" for help.

    murmuring-headland-14719::DATABASE=>`
}

module.exports = [
  Object.assign({topic: 'pg', command: 'psql'}, cmd),
  Object.assign({topic: 'psql'}, cmd)
]
