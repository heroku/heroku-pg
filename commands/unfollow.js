'use strict'

const cli = require('heroku-cli-util')
const co = require('co')

function * run (context, heroku) {
  const host = require('../lib/host')
  const util = require('../lib/util')
  const fetcher = require('../lib/fetcher')(heroku)
  let {app, args, flags} = context
  let db = yield fetcher.addon(app, args.database)

  let replica = yield heroku.get(`/client/v11/databases/${db.id}`, {host: host(db)})

  if (!replica.following) throw new Error(`${cli.color.addon(db.name)} is not a follower`)

  let origin = util.databaseNameFromUrl(replica.following, yield heroku.get(`/apps/${app}/config-vars`))
  yield cli.confirmApp(app, flags.confirm, `WARNING: Destructive action
${cli.color.addon(db.name)} will become writeable and no longer follow ${origin}. This cannot be undone.
`)

  let response = { leader_xact: 0, follower_xact: 0 }
  yield cli.action(`${cli.color.addon(db.name)} unfollowing`, co(function * () {
    response = yield heroku.put(`/client/v11/databases/${db.id}/unfollow`, {host: host(db)})
  }))

  if (response.leader_xact > response.follower_xact) {
    cli.warn(`you unfollowed this database while the leader transaction was ${response.leader_xact} and the follower transaction was ${response.follower_xact}. Due to the lag, you may experience read-only mode with the unfollowed database (${db.name}) for a while.`)
  }
}

module.exports = {
  topic: 'pg',
  command: 'unfollow',
  description: 'stop a replica from following and make it a writeable database',
  needsApp: true,
  needsAuth: true,
  args: [{name: 'database'}],
  flags: [{name: 'confirm', char: 'c', hasValue: true}],
  run: cli.command({preauth: true}, co.wrap(run))
}
