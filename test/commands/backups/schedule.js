'use strict'
/* global describe it beforeEach afterEach */

const cli = require('heroku-cli-util')
const expect = require('unexpected')
const nock = require('nock')
const cmd = require('../../..').commands.find(c => c.topic === 'pg' && c.command === 'backups:schedule')

const shouldSchedule = function (cmdRun) {
  let pg, api

  beforeEach(() => {
    api = nock('https://api.heroku.com')
    api.post('/actions/addon-attachments/resolve', {app: 'myapp', addon_attachment: 'DATABASE_URL'}).reply(200, [
      {
        addon: {
          id: 1,
          name: 'postgres-1',
          plan: {name: 'heroku-postgresql:standard-0'}
        },
        config_vars: [
          'DATABASE_URL'
        ]
      }
    ])

    let dbA = {info: [
      {name: 'Plan', values: ['Hobby-dev']},
      {name: 'Empty', values: []},
      {name: 'Following', resolve_db_name: true, values: ['postgres://ec2-54-111-111-1.compute-1.amazonaws.com:5452/dxxxxxxxxxxxx']},
      {name: 'Continuous Protection', values: ['On']}
    ]}
    pg = nock('https://postgres-api.heroku.com')
    pg.get('/client/v11/databases/1').reply(200, dbA)

    cli.mockConsole()
  })

  afterEach(() => {
    nock.cleanAll()
    api.done()
    pg.done()
  })

  it('schedules a backup', () => {
    pg.post('/client/v11/databases/1/transfer-schedules', {
      'hour': '06', 'timezone': 'America/New_York', 'schedule_name': 'DATABASE_URL'
    }).reply(201)
    return cmdRun({app: 'myapp', args: {}, flags: {at: '06:00 EDT', confirm: 'myapp'}})
    .then(() => expect(cli.stdout, 'to equal', ''))
    .then(() => expect(cli.stderr, 'to equal', 'Scheduling automatic daily backups of postgres-1 at 06:00 America/New_York... done\n'))
  })
}

describe('pg:backups:schedule', () => {
  shouldSchedule((args) => cmd.run(args))
})

describe('pg:backups schedule', () => {
  shouldSchedule(require('./helpers.js').dup('schedule', cmd))
})
