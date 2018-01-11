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
    api.post('/addon-attachments').reply(200, {name: 'HEROKU_COLOR'})
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
      pg.get(`/client/v11/databases/${addon.id}/pgbouncer_status`).reply(200, {status: 'enabled'})
    })

    it('attaches the pgbouncer url', () => {
      api.get(`/addons/postgres-1/config/credential:${name}`).reply(200)
      api.get(`/addons/postgres-1/config/connection-pooling:${name}`).reply(200)

      return cmd.run({app: 'myapp', args: {database: 'postgres-1'}, flags: {credential: name}})
      .then(() => expect(cli.stdout, 'to equal', ``))
      .then(() => expect(cli.stderr, 'to contain', 'Setting HEROKU_COLOR config vars and restarting myapp... done, v0\n'))
    })

    it('throws an error if the credential config is not set', () => {
      api.get(`/addons/postgres-1/config/credential:${name}`).reply(200)
      api.get(`/addons/postgres-1/config/connection-pooling:${name}`).reply(200, [])

      const err = new Error('Could not find credential default with connection pooling for database postgres-1')
      return expect(cmd.run({app: 'myapp', args: {database: 'postgres-1'}, flags: {credential: name}}), 'to be rejected with', err)
    })

    it('throws an error if the credential does not exist', () => {
      name = "no-user"
      api.get(`/addons/postgres-1/config/credential:${name}`).reply(200, [])

      const err = new Error('Could not find credential no-user for database postgres-1')
      return expect(cmd.run({app: 'myapp', args: {database: 'postgres-1'}, flags: {credential: name}}), 'to be rejected with', err)
    })
  })

  it('throws an error if the formation does not pgbouncer setup', () => {
    pg.get(`/client/v11/databases/${addon.id}/pgbouncer_status`).reply(200, {status: 'disabled'})

    const err = new Error('The database postgres-1 does not have connection pooling enabled')
    return expect(cmd.run({app: 'myapp', args: {database: 'postgres-1'}, flags: {credential: name}}), 'to be rejected with', err)
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

    const err = new Error('This operation is not supported by Hobby tier databases.')
    return expect(cmd.run({app: 'myapp', args: {database: 'postgres-1'}, flags: {credential: 'jeff'}}), 'to be rejected with', err)
  })
})
