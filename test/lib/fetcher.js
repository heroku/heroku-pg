'use strict'
/* global describe beforeEach afterEach it */

const nock = require('nock')
const expect = require('unexpected')
const proxyquire = require('proxyquire')
const Heroku = require('heroku-client')
const fetcher = proxyquire('../../lib/fetcher', {
  'heroku-cli-addons': {
    resolve: {
      attachment: () => Promise.resolve({addon: {id: 100}})
    }
  }
})

describe('fetcher', () => {
  let heroku = new Heroku()
  let api

  beforeEach(() => {
    api = nock('https://api.heroku.com:443')
  })

  afterEach(() => {
    nock.cleanAll()
    api.done()
  })

  describe('addon', () => {
    it('returns addon attached to app', () => {
      api.get('/addons/100').reply(200, {name: 'postgres-1'})

      return fetcher.addon(heroku, 'myapp', 'DATABASE_URL')
      .then(addon => {
        expect(addon.name, 'to equal', 'postgres-1')
      })
    })
  })

  describe('all', () => {
    it('returns all addons attached to app', () => {
      let plan = {name: 'heroku-postresql:hobby-dev'}
      let service = {name: 'heroku-postgresql'}
      let addons = [
        {id: 100, name: 'postgres-1', addon_service: service, plan, config_vars: ['DATABASE_URL', 'HEROKU_POSTGRESQL_PINK_URL']},
        {id: 101, name: 'postgres-2', addon_service: service, plan, config_vars: ['HEROKU_POSTGRESQL_BRONZE_URL']},
        {id: 102, name: 'postgres-3', addon_service: service, plan, config_vars: ['HEROKU_POSTGRESQL_COBALT_URL']}
      ]
      let attachments = [
        {addon: {id: 100}},
        {addon: {id: 101}}
      ]
      api.get('/apps/myapp/addon-attachments').reply(200, attachments)
      api.get('/addons').reply(200, addons)

      return fetcher.all(heroku, 'myapp', 'DATABASE_URL')
      .then(addons => {
        expect(addons[0], 'to satisfy', {name: 'postgres-1'})
        expect(addons[1], 'to satisfy', {name: 'postgres-2'})
        expect(addons.length, 'to equal', 2)
      })
    })
  })
})
