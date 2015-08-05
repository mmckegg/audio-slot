var Processor = require('../processor.js')
var Property = require('observ-default')

var Param = require('audio-slot-param')
var Apply = require('audio-slot-param/apply')

module.exports = FilterNode

function FilterNode (context) {
  var node = context.audio.createBiquadFilter()

  var obs = Processor(context, node, node, {
    frequency: Param(context, node.frequency.defaultValue),
    Q: Param(context, node.Q.defaultValue),
    gain: Param(context, node.gain.defaultValue),
    type: Property(node.type)
  })

  obs.type(function (value) {
    node.type = value
  })

  Apply(context, node.frequency, obs.frequency)
  Apply(context, node.Q, obs.Q)
  Apply(context, node.gain, obs.gain)

  return obs
}
