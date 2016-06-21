'use strict'
/* global describe it beforeEach afterEach context */

const cli = require('heroku-cli-util')
const expect = require('unexpected')
const nock = require('nock')
const proxyquire = require('proxyquire')

let all = []
let addon
const fetcher = {
  all: () => all,
  addon: () => addon
}

const cmd = proxyquire('../../commands/info', {
  '../lib/fetcher': fetcher
}).root

describe('pg', () => {
  let api, pg

  beforeEach(() => {
    api = nock('https://api.heroku.com:443')
    pg = nock('https://postgres-starter-api.heroku.com:443')
    cli.mockConsole()
  })

  afterEach(() => {
    nock.cleanAll()
    api.done()
    pg.done()
  })

  context('with 0 dbs', () => {
    it('shows empty state', () => {
      all = []

      return cmd.run({app: 'myapp', args: {}})
      .then(() => expect(cli.stdout, 'to equal', 'myapp has no heroku-postgresql databases.\n'))
      .then(() => expect(cli.stderr, 'to equal', ''))
    })
  })

  context('with 2 dbs', () => {
    let plan = {name: 'heroku-postresql:hobby-dev'}
    let config = {HEROKU_POSTGRESQL_COBALT_URL: 'postgres://uxxxxxxxxx:pxxxxxxxx@ec2-54-111-111-1.compute-1.amazonaws.com:5452/dxxxxxxxxxxxx'}
    let addonService = {name: 'heroku-postgresql'}
    let addons = [
      {id: 1, name: 'postgres-1', addon_service: addonService, plan, config_vars: ['DATABASE_URL', 'HEROKU_POSTGRESQL_PINK_URL']},
      {id: 2, name: 'postgres-2', addon_service: addonService, plan, config_vars: ['HEROKU_POSTGRESQL_BRONZE_URL']}
    ]
    let dbA = {info: [
      {name: 'Plan', values: ['Hobby-dev']},
      {name: 'Empty', values: []},
      {name: 'Following', resolve_db_name: true, values: ['postgres://uxxxxxxxxx:pxxxxxxxx@ec2-54-111-111-1.compute-1.amazonaws.com:5452/dxxxxxxxxxxxx']}
    ]}
    let dbB = {info: [
      {name: 'Plan', values: ['Hobby-dev']},
      {name: 'Following', resolve_db_name: true, values: ['postgres://uxxxxxxxxx:pxxxxxxxx@ec2-55-111-111-1.compute-1.amazonaws.com/dxxxxxxxxxxxx']}
    ]}

    it('shows postgres info', () => {
      all = addons

      api.get('/apps/myapp/config-vars').reply(200, config)
      pg
      .get('/client/v11/databases/postgres-1').reply(200, dbA)
      .get('/client/v11/databases/postgres-2').reply(200, dbB)

      return cmd.run({app: 'myapp', args: {}})
      .then(() => expect(cli.stdout, 'to equal', `=== postgres-1
Config Vars: DATABASE_URL, HEROKU_POSTGRESQL_PINK_URL
Plan:        Hobby-dev
Following:   HEROKU_POSTGRESQL_COBALT

=== postgres-2
Config Vars: HEROKU_POSTGRESQL_BRONZE_URL
Plan:        Hobby-dev
Following:   ec2-55-111-111-1.compute-1.amazonaws.com:5432/dxxxxxxxxxxxx

`))
      .then(() => expect(cli.stderr, 'to equal', ''))
    })

    it('shows postgres info for single database when arg sent in', () => {
      addon = addons[1]
      api.get('/apps/myapp/config-vars').reply(200, config)

      pg
      .get('/client/v11/databases/postgres-2')
      .reply(200, dbB)
      return cmd.run({app: 'myapp', args: {database: 'postgres-2'}})
      .then(() => expect(cli.stdout, 'to equal', `=== postgres-2
Config Vars: HEROKU_POSTGRESQL_BRONZE_URL
Plan:        Hobby-dev
Following:   ec2-55-111-111-1.compute-1.amazonaws.com:5432/dxxxxxxxxxxxx

`))
      .then(() => expect(cli.stderr, 'to equal', ''))
    })
  })
})
