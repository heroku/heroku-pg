'use strict'

const co = require('co')
const cli = require('heroku-cli-util')
const url = require('url')

function * run (context, heroku) {
  const host = require('../../lib/host')
  const fetcher = require('../../lib/fetcher')(heroku)
  const util = require('../../lib/util')

  const {app, args, flags} = context

  let db = yield fetcher.addon(app, args.database)
  let cred = flags.name || 'default'
  if (util.starterPlan(db) && cred !== 'default') throw new Error('This operation is not supported by Hobby tier databases.')
  let roleInfo = yield heroku.get(`/postgres/v0/databases/${db.name}/credentials/${encodeURIComponent(cred)}`,
                                   { host: host(db) })

  let roleCreds = roleInfo.credentials.find((c) => c.state === 'active')
  if (!roleCreds) {
    cli.exit(1, `could not find any active credentials for ${cred}`)
  }

  let creds = Object.assign({}, db, {
    database: roleInfo.database,
    host: roleInfo.host,
    port: roleInfo.port
  }, {
    user: roleCreds.user,
    password: roleCreds.password
  })

  let connUrl = url.format({
    pathname: `/${creds.database}`,
    host: `${creds.host}:${creds.port}`,
    auth: `${creds.user}:${creds.password}`,
    protocol: 'postgres:',
    slashes: true
  })
  cli.log(`Connection information for ${cred} credential.
Connection info string:
   "dbname=${creds.database} host=${creds.host} port=${creds.port} user=${creds.user} password=${creds.password} sslmode=require"
Connection URL:
   ${connUrl}`)
}

module.exports = {
  topic: 'pg',
  command: 'credentials:url',
  description: 'show database credentials',
  needsApp: true,
  needsAuth: true,
  flags: [
    {name: 'name', char: 'n', description: 'which credentials to show (default credentials if not specified)', hasValue: true}
  ],
  args: [{name: 'database', optional: true}],
  run: cli.command({preauth: true}, co.wrap(run))
}
