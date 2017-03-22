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

const cmd = proxyquire('../../../commands/credentials/destroy', {
  '../../lib/fetcher': fetcher
})

describe('pg:credentials:destroy', () => {
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

  it('destroys the credential', () => {
    pg.delete('/postgres/v0/databases/postgres-1/credentials/credname').reply(200)
    return cmd.run({app: 'myapp', args: {}, flags: {name: 'credname', confirm: 'myapp'}})
    .then(() => expect(cli.stderr, 'to equal', 'Destroying credential credname... done\n'))
    .then(() => expect(cli.stdout, 'to equal', `The credential has been destroyed within postgres-1 and detached from all apps.
Database objects owned by credname will be assigned to the default credential
`))
  })
})
