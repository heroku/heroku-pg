'use strict'

const co = require('co')
const cli = require('heroku-cli-util')
const url = require('url')

function * run (context, heroku) {
  const host = require('../../lib/host')
  const fetcher = require('../../lib/fetcher')(heroku)

  const {app, args, flags} = context

  let db = yield fetcher.addon(app, args.database)
  let cred = flags.name || 'default'
  let roleInfo = yield heroku.get(`/postgres/v0/databases/${db.name}/credentials/${cred}`,
                                   { host: host(db) })

  let roleCreds = roleInfo.credentials.find((c) => c.user === cred && c.state === 'active')
  if (!roleCreds) {
    cli.exit(1, `could not find any active credentialss for ${cred}`)
  }

  let creds = Object.assign({ port: 5432 }, db, {
    database: roleInfo.database,
    host: roleInfo.host
  }, {
    user: roleCreds.user,
    password: roleCreds.password
  },
  )

  let connUrl = url.format({
    pathname: `/${creds.database}`,
    host: `${creds.host}:${creds.port}`,
    auth: `${creds.user}:${creds.password}`,
    protocol: 'postgres:',
    slashes: true
  })
  console.log('got here')
  cli.log(`Connection info string:
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
    {name: 'name', description: 'which credentials to show (default credentials if not specified)'}
  ],
  args: [{name: 'database', optional: true}],
  run: cli.command({preauth: true}, co.wrap(run))
}
