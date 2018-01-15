'use strict'
/* global describe it beforeEach afterEach context */

const cli = require('heroku-cli-util')
const expect = require('unexpected')
const nock = require('nock')
const proxyquire = require('proxyquire')

const db = {
  database: 'mydb',
  host: 'foo.com',
  user: 'jeff',
  password: 'pass',
  url: {href: 'postgres://jeff:pass@foo.com/mydb'}
}

const addon = {
  name: 'postgres-1',
  id: '1234',
  plan: {name: 'heroku-postgresql:standard-0'}
}

const fetcher = () => {
  return {
    database: () => db,
    addon: () => addon
  }
}

const cmd = proxyquire('../../commands/connection_pooling', {
  '../lib/fetcher': fetcher
})

describe('pg:connection-polling:attach', () => {
  let api, pg
  let name = 'default'

  beforeEach(() => {
    api = nock('https://api.heroku.com')
    pg = nock('https://postgres-api.heroku.com')
    api.get('/addons/postgres-1').reply(200, addon)
    api.get('/apps/myapp/releases').reply(200, [{version: 0}])

    cli.mockConsole()
  })

  afterEach(() => {
    nock.cleanAll()
    pg.done()
    api.done()
  })

  context('with pgbouncer enabled', () => {
    beforeEach(() => {
      pg.post(`/client/v11/databases/${addon.name}/connection-pooling`, {
        credential: name
      }).reply(201, {name: 'HEROKU_COLOR'})
    })

    it('attaches the pgbouncer url', () => {
      return cmd.run({app: 'myapp', args: {database: 'postgres-1'}, flags: {credential: name}})
      .then(() => expect(cli.stdout, 'to equal', ``))
      .then(() => expect(cli.stderr, 'to contain', 'Setting HEROKU_COLOR config vars and restarting myapp... done, v0\n'))
    })
  })
})
