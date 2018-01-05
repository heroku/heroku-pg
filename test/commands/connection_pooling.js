'use strict'
/* global describe it beforeEach afterEach */

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
  let api

  beforeEach(() => {
    api = nock('https://api.heroku.com')
    cli.mockConsole()
  })

  afterEach(() => {
    nock.cleanAll()
    api.done()
  })

  it('attaches the pgbouncer url', () => {
    api.get('/addons/postgres-1').reply(200)
    api.post('/addon-attachments').reply(200, {name: 'HEROKU_COLOR'})
    api.get('/addons/postgres-1/config/credential:default').reply(200)
    api.get('/apps/myapp/releases').reply(200, [{version: 0}])
    return cmd.run({app: 'myapp', args: {database: 'postgres-1'}, flags: {name: 'default'}})
    .then(() => expect(cli.stdout, 'to equal', ``))
    .then(() => expect(cli.stderr, 'to contain', 'Setting HEROKU_COLOR config vars and restarting myapp... done, v0\n'))
  })

  it('throws an error when the db is starter plan', () => {
    const hobbyAddon = {
      name: 'postgres-1',
      plan: {name: 'heroku-postgresql:hobby-dev'}
    }

    const fetcher = () => {
      return {
        database: () => db,
        addon: () => hobbyAddon
      }
    }

    const cmd = proxyquire('../../commands/connection_pooling', {
      '../lib/fetcher': fetcher
    })

    api.get('/addons/postgres-1').reply(200)
    api.post('/addon-attachments').reply(200)
    api.get('/addons/postgres-1/config/credential:default').reply(200)
    api.get('/apps/myapp/releases').reply(200, [{version: 0}])

    const err = new Error('This operation is not supported by Hobby tier databases.')
    return expect(cmd.run({app: 'myapp', args: {database: 'postgres-1'}, flags: {name: 'jeff'}}), 'to be rejected with', err)
  })
})
