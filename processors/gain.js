var Processor = require('../processor.js')
var Param = require('audio-slot-param')
var Apply = require('audio-slot-param/apply')

module.exports = GainNode

function GainNode (context) {
  var node = context.audio.createGain()

  var obs = Processor(context, node, node, {
    gain: Param(context, node.gain.defaultValue)
  })

  Apply(context, node.gain, obs.gain)

  return obs
}
