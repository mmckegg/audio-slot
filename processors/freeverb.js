var Freeverb = require('freeverb')
var Processor = require('../processor.js')
var Param = require('../param.js')
var Property = require('../property.js')
var Apply = require('../modulators/apply')
var watch = require('observ/watch')

module.exports = FreeverbNode

function FreeverbNode(context){

  var reverb = Freeverb(context.audio)

  var obs = Processor(context, reverb, reverb, {
    roomSize: Property(0.8),
    dampening: Property(3000),
    wet: Param(context, 1),
    dry: Param(context, 1)
  })

  watch(obs.roomSize, function(value) {
    reverb.roomSize = Math.min(1, Math.max(0, value))
  })

  watch(obs.dampening, function(value) {
    reverb.dampening = Math.min(20000, Math.max(0, value))
  })

  Apply(context, reverb.wet, obs.wet)
  Apply(context, reverb.dry, obs.dry)

  return obs
}