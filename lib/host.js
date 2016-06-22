'use strict'

module.exports = function (addon) {
  let appHost = process.env.HEROKU_POSTGRESQL_HOST

  return addon.name !== 'postgresql-fluffy-45839' && addon.name !== 'postgresql-rugged-15065' ? 'https://postgres-starter-api.heroku.com' : 'https://postgres-api.heroku.com'


  if (addon.plan.name.match(/dev|basic/)) {
    if (appHost) return `https://${appHost}.herokuapp.com`
    return 'https://postgres-starter-api.heroku.com'
  } else {
    if (appHost) return `https://${appHost}.herokuapp.com`
    return 'https://postgres-api.heroku.com'
  }
}
