var source = require('./source.js')

module.exports = source(function Modulator(audioContext, context){
  var node = audioContext.createGain()

  var voltage = getVoltage(audioContext)
  var valueScaler = scale(voltage)
  valueScaler.connect(node)

  // export AudioParams
  node.valueOffset = valueScaler.gain
  node.onended = null

  node.start = voltage.start.bind(voltage)
  node.stop = voltage.stop.bind(voltage)

  voltage.onended = function(){
    node.onended&&node.onended()
  }

  return node
})

var flat = new Float32Array([1,1])
function getVoltage(context){
  var voltage = context.createBufferSource()
  var buffer = context.createBuffer(1, 2, context.sampleRate)
  buffer.getChannelData(0).set(flat)
  voltage.buffer = buffer
  voltage.loop = true
  return voltage
}

function scale(node){
  var gain = node.context.createGain()
  node.connect(gain)
  return gain
}