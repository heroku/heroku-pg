'use strict'

const co = require('co')

function * addon (heroku, app, db) {
  const {resolve} = require('heroku-cli-addons')

  let attachment = yield resolve.attachment(heroku, app, db || 'DATABASE_URL', {'Accept-Inclusion': 'addon:plan'})
  return attachment.addon
}

function * databaseURL (heroku, app, db) {
  const url = require('url')

  let addonID = (yield addon(heroku, app, db)).id
  let [addon, config] = yield [
    heroku.get(`/addons/${addonID}`),
    heroku.get(`/apps/${app}/config-vars`)
  ]

  return url.parse(config[addon.config_vars[0]])
}

function * all (heroku, app) {
  const uniqby = require('lodash.uniqby')

  let attachments = yield heroku.get(`/apps/${app}/addon-attachments`, {
    headers: {'Accept-Inclusion': 'addon:plan'}
  })
  let addons = attachments.map(a => a.addon)
  addons = addons.filter(a => a.plan.name.startsWith('heroku-postgresql'))
  addons = uniqby(addons, 'id')

  return addons
}

module.exports = {
  addon: co.wrap(addon),
  all: co.wrap(all),
  databaseURL: co.wrap(databaseURL)
}
