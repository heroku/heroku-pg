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

const cmd = proxyquire('../../commands/credentials', {
  '../lib/fetcher': fetcher
})

describe('pg:credentials', () => {
  let api, pg

  beforeEach(() => {
    api = nock('https://api.heroku.com')
    pg = nock('https://postgres-api.heroku.com')
    cli.mockConsole()
  })

  afterEach(() => {
    nock.cleanAll()
    api.done()
  })

  it('shows the correct credentials', () => {
    let credentials = [
      { uuid: 'aaaa',
        name: 'jeff',
        state: 'created',
        database: 'd123',
        host: 'localhost',
        port: 5442,
        credentials: [] },
      { uuid: 'aabb',
        name: 'ransom',
        state: 'rotating',
        database: 'd123',
        host: 'localhost',
        port: 5442,
        credentials: [] }
    ]
    pg.get('/postgres/v0/databases/postgres-1/credentials').reply(200, credentials)

    return cmd.run({app: 'myapp', args: {}, flags: {name: 'jeff'}})
              .then(() => expect(cli.stdout,
                                 'to equal',
                                 'Credential  State\n──────────  ────────\njeff        created\nransom      rotating\n'))
  })
})
