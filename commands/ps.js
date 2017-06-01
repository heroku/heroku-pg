'use strict'

const co = require('co')
const cli = require('heroku-cli-util')

function * run (context, heroku) {
  const fetcher = require('../lib/fetcher')(heroku)
  const psql = require('../lib/psql')

  const {app, args, flags} = context
  const {database} = args
  const {verbose} = flags

  let db = yield fetcher.database(app, database)
  let addon = yield fetcher.addon(app, database)

  const num = Math.random()
  const waitingMarker = `${num}${num}`

  let waitingQuery = `
SELECT '${num}' || '${num}' WHERE EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_schema = 'pg_catalog'
    AND table_name = 'pg_stat_activity'
    AND column_name = 'waiting'
)
`
  let waitingOutput = yield psql.exec(db, waitingQuery)
  let waiting = waitingOutput.includes(waitingMarker)
                ? 'waiting'
                : 'wait_event IS NOT NULL AS waiting'
  let query = `
SELECT
 pid,
 state,
 application_name AS source,
 usename AS username,
 age(now(),xact_start) AS running_for,
 ${waiting},
 query
FROM pg_stat_activity
WHERE
 pid <> pg_backend_pid()
 ORDER BY query_start DESC
`

  let output = yield psql.exec(db, query)
  process.stdout.write(output)
}

module.exports = {
  topic: 'pg',
  command: 'ps',
  description: 'view active queries with execution time',
  needsApp: true,
  needsAuth: true,
  flags: [{name: 'verbose', char: 'v'}],
  args: [{name: 'database', optional: true}],
  run: cli.command({preauth: true}, co.wrap(run))
}
