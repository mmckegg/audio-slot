var Observ = require('observ')

module.exports = Prop

function Prop(defaultValue) {
  var obs = Observ(defaultValue)
  var set = obs.set
  obs.set = function(v){
    set(v == null ? defaultValue : v)
  }
  return obs
}
