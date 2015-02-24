var ObservStruct = require('observ-struct')
var Param = require('./param.js')

module.exports = ProcessorNode

function ProcessorNode(context, input, output, params){
  var obs = ObservStruct(params)

  obs.input = input
  obs.output = output
  obs.connect = output.connect.bind(output)
  obs.disconnect = output.disconnect.bind(output)
  obs.getReleaseDuration = Param.getReleaseDuration.bind(this, obs)
  obs.context = context

  obs.triggerOn = function(at){
    at = Math.max(at||0, context.audio.currentTime)
    Param.triggerOn(obs, at)
  }

  obs.triggerOff = function(at){
    at = Math.max(at||0, context.audio.currentTime)
    var stopAt = obs.getReleaseDuration(at) + at
    Param.triggerOff(obs, stopAt)
  }

  return obs
}