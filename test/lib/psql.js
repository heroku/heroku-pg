'use strict'

/* global describe it */

const sinon = require('sinon')
const psql = require('../../lib/psql')

const db = {
  user: 'jeff',
  password: 'pass',
  database: 'mydb',
  port: 5432,
  host: 'localhost'
}

describe('psql', () => {
  describe('exec', () => {
    it('runs psql', sinon.test(() => {
      let cp = sinon.mock(require('child_process'))
      let env = Object.assign({}, process.env, {
        PGAPPNAME: 'psql non-interactive',
        PGSSLMODE: 'prefer',
        PGUSER: 'jeff',
        PGPASSWORD: 'pass',
        PGDATABASE: 'mydb',
        PGPORT: 5432,
        PGHOST: 'localhost'
      })
      let opts = {env: env, encoding: 'utf8'}
      let onHandler = function (key, data) {
        return Promise.resolve('result')
      }
      cp.expects('spawn').withExactArgs('psql', ['-c', 'SELECT NOW();'], opts).once().returns(
        {
          stdout: {
            on: onHandler
          },
          stderr: {
            on: onHandler
          },
          on: onHandler
        }
      )
      return psql.exec(db, 'SELECT NOW();', 1000)
      .then(() => cp.verify())
      .then(() => cp.restore())
    }))
  })
})
