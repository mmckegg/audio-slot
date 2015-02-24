var Observ = require('observ')

module.exports = Property

function Property(defaultValue) {
  var obs = Observ(defaultValue)
  var set = obs.set
  obs.set = function(v){
    set(v == null ? defaultValue : v)
  }
  return obs
}
