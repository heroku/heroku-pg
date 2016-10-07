'use strict'

function prefix (transfer) {
  if (transfer.from_type === 'pg_dump') {
    if (transfer.to_type === 'pg_restore') {
      return 'c'
    } else {
      return transfer.schedule ? 'a' : 'b'
    }
  } else {
    if (transfer.to_type === 'pg_restore') {
      return 'r'
    } else {
      return 'b'
    }
  }
}

module.exports = {
  filesize: size => {
    const filesize = require('filesize')
    return filesize(size, {round: 1})
  },
  transfer: {
    name: transfer => {
      let S = require('string')

      let oldPGBName = transfer.options && transfer.options.pgbackups_name
      if (oldPGBName) return `o${oldPGBName}`
      return `${prefix(transfer)}${S(transfer.num).padLeft(3, '0')}`
    },
    status: transfer => {
      if (transfer.finished_at && transfer.succeeded) {
        let warnings = transfer.warnings
        if (warnings > 0) {
          return `Finished with ${warnings} warnings`
        } else {
          return `Completed ${transfer.finished_at}`
        }
      } else if (transfer.finished_at) {
        return `Failed ${transfer.finished_at}`
      } else if (transfer.started_at) {
        return `Running (processed ${module.exports.filesize(transfer.processed_bytes, {round: 1})})`
      } else {
        return 'Pending'
      }
    }
  }
}
