var Observ = require('observ')
var watchModulators = require('./lib/watch-modulators')
var setParamsOn = require('./lib/set-params')
var watch = require('observ/watch')

module.exports = function(ctor){
  return function Processor(context){
    var obs = Observ({})

    obs._type = 'AudioProcessor'
    obs.context = context

    var node = ctor(context.audio, context)
    var releaseTempo = null

    obs.input = node
    obs.output = node
    obs.connect = node.connect.bind(node)
    obs.disconnect = node.disconnect.bind(node)

    var modulators = {}
    watchModulators(context, obs, function(attributes, m){
      modulators = m
      setParamsOn(attributes, modulators, node)
    })

    if ('tempo' in node && typeof context.tempo == 'function'){
      releaseTempo = watch(context.tempo, updateTempo)
    }

    obs.getReleaseDuration = function(){
      var maxDuration = 0
      Object.keys(modulators).forEach(function(key){
        if (modulators[key].getReleaseDuration){
          var t = modulators[key].getReleaseDuration()
          if (t > maxDuration){
            maxDuration = t
          }
        }
      })
      return maxDuration
    }

    obs.triggerOn = function(at){
      Object.keys(modulators).forEach(function(key){
        modulators[key].triggerOn(at)
      })
    }

    obs.triggerOff = function(at){
      var stopAt = at
      Object.keys(modulators).forEach(function(key){
        var t = modulators[key].triggerOff(at)
        if (t > stopAt){
          stopAt = t
        }
      })
      return stopAt
    }

    obs.destroy = function(){
      releaseTempo&&releaseTempo()
      releaseTempo = null
    }

    return obs

    // scoped

    function updateTempo(value){
      node.tempo = value
    }
  }
}