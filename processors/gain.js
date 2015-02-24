var Processor = require('../processor.js')
var Param = require('../param.js')
var Apply = require('../modulators/apply')

module.exports = GainNode

function GainNode(context){
  var node = context.audio.createGain()

  var obs = Processor(context, node, node, {
    gain: Param(context, node.gain.defaultValue)
  })

  Apply(context, node.gain, obs.gain)

  return obs
}