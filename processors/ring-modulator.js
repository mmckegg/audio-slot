var Processor = require('../processor.js')
var Param = require('audio-slot-param')
var Apply = require('audio-slot-param/apply')
var Oscillator = require('../sources/oscillator')

module.exports = RingModulatorNode

function RingModulatorNode (context) {
  var node = context.audio.createGain()

  var obs = Processor(context, node, node, {
    carrier: Oscillator(context)
  })

  obs.carrier.connect(node.gain)
  
  return obs
}
