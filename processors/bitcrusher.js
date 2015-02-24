var Processor = require('../processor.js')
var Param = require('../param.js')
var Property = require('../property.js')
var Bitcrusher = require('bitcrusher')
var watch = require('observ/watch')

module.exports = BitcrusherNode

function BitcrusherNode(context){
  var node = Bitcrusher(context.audio, { bufferSize: 256 })

  var obs = Processor(context, node, node, {
    bitDepth: Property(8),
    frequency: Property(1)
  })

  watch(obs.bitDepth, function(value){
    node.bitDepth = value
  })
 
  watch(obs.frequency, function(value){
    node.frequency = value
  })

  return obs
}
