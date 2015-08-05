var Observ = require('observ')
var watch = require('observ/watch')

module.exports = ResolvedValue

function ResolvedValue (node) {
  var obs = Observ()
  var release = null

  node.onNode(function (node) {
    release && release()
    release = null
    if (node && typeof node.resolved === 'function') {
      release = watch(node.resolved, obs.set)
    } else {
      obs.set(null)
    }
  })

  return obs
}
