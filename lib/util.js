const debug = require('./debug')
const url = require('url')
const sample = require('lodash.sample')

const getBastion = function (config, baseName) {
  // If there are bastions, extract a host and a key
  // otherwise, return an empty Object

  // If there are bastions:
  // * there should be one *_BASTION_KEY
  // * pick one host from the comma-separated list in *_BASTIONS
  // We assert that _BASTIONS and _BASTION_KEY always exist together
  // If either is falsy, pretend neither exist

  const bastionKey = config[`${baseName}_BASTION_KEY`]
  const bastionHost = sample(config[`${baseName}_BASTIONS`].split(','))
  return (!(bastionKey && bastionHost))
    ? {}
    : {bastionHost, bastionKey}
}

exports.getConnectionDetails = function (addon, config) {
  const connstrings = addon.config_vars
    .filter((cv) => (
      config[cv].startsWith('postgres://')
      && cv.endsWith('_URL')
    ))

  if (connstrings.length === 0) {
    // TODO blow up in a useful fashion
  }

  const baseName = connstrings[0].slice(0, -4)

  // build the default payload for non-bastion dbs
  debug(`Using "${connstrings[0]}" to connect to your database…`)
  const target = url.parse(config[connstrings[0]])
  let [user, password] = target.auth.split(':')

  let payload = {
    user,
    password,
    database: target.path.split('/', 2)[1],
    host: target.hostname,
    port: target.port
  }

  // If bastion creds exist, graft it into the payload
  const bastion = getBastion(config, baseName)
  if (bastion) {
    Object.assign(payload, bastion)
  }

  console.log(payload)
  return payload
}