'use strict'

const cli = require('heroku-cli-util')
const co = require('co')

module.exports = {
  topic: 'pg',
  command: 'vacuum-progress',
  description: 'determine the progress of Postgres vacuum workers',
  needsApp: true,
  needsAuth: true,
  args: [{name: 'database', optional: true}],
  run: cli.command({preauth: true}, co.wrap(run))
}
