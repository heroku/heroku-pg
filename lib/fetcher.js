'use strict'

const co = require('co')

function * addon (heroku, app, db) {
  const {resolve} = require('heroku-cli-addons')
  let attachment = yield resolve.attachment(heroku, app, db)
  return yield heroku.get(`/addons/${attachment.addon.id}`)
}

function * all (heroku, app) {
  const sortBy = require('lodash.sortby')
  const notDatabaseUrl = (a) => !a.config_vars.find((c) => c === 'DATABASE_URL')

  // TODO: make this more efficient without having to call /addons
  // (will require an API change of some sort)
  let {attachments, addons} = yield {
    attachments: heroku.get(`/apps/${app}/addon-attachments`),
    addons: heroku.get('/addons')
  }
  addons = addons.filter(a => a.addon_service.name === 'heroku-postgresql')
  addons = addons.filter(addon => attachments.find(attachment => addon.id === attachment.addon.id))
  addons = sortBy(addons, notDatabaseUrl, 'name')
  return addons
}

module.exports = {
  all: co.wrap(all),
  addon: co.wrap(addon)
}
