var Processor = require('../processor.js')
var Param = require('audio-slot-param')
var Apply = require('audio-slot-param/apply')

module.exports = CompressorNode

function CompressorNode (context) {
  var node = context.audio.createDynamicsCompressor()
  node.ratio.value = 20
  node.threshold.value = -1

  var obs = Processor(context, node, node, {
    threshold: Param(context, node.threshold.defaultValue),
    knee: Param(context, node.knee.defaultValue),
    ratio: Param(context, node.ratio.defaultValue),
    reduction: Param(context, node.reduction.defaultValue),
    attack: Param(context, node.attack.defaultValue),
    release: Param(context, node.release.defaultValue)
  })

  Apply(context, node.threshold, obs.threshold)
  Apply(context, node.knee, obs.knee)
  Apply(context, node.ratio, obs.ratio)
  Apply(context, node.reduction, obs.reduction)
  Apply(context, node.attack, obs.attack)
  Apply(context, node.release, obs.release)

  return obs
}
