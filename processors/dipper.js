var Processor = require('../processor.js')

var Property = require('../property.js')
var Param = require('audio-slot-param')
var watch = require('observ/watch')

var Apply = require('audio-slot-param/apply')

module.exports = DipperNode

function DipperNode(context){
  var dipper = initializeMasterDipper(context.audio)
  var input = context.audio.createGain()
  var from = context.audio.createGain()
  var to = context.audio.createGain()
  var output = context.audio.createGain()

  input.connect(output)
  input.connect(to)
  dipper.connect(from)

  var obs = Processor(context, input, output, {
    mode: Property('modulate'),
    ratio: Param(context, 1)
  })

  watch(obs.mode, function(value){
    if (value === 'source'){
      from.disconnect()
      to.connect(dipper)
    } else {
      to.disconnect()
      from.connect(output.gain)
    }
  })

  obs.destroy = function(){
    to.disconnect()
    from.disconnect()
  }

  Apply(context, to.gain, obs.ratio)
  Apply(context, from.gain, obs.ratio)

  return obs
}

function initializeMasterDipper(audioContext){
  if (!audioContext.globalDipperProcessor){
    audioContext.globalDipperProcessor = audioContext.createScriptProcessor(1024*2, 2, 1)
    var lastValue = 0
    var targetValue = 0

    audioContext.globalDipperProcessor.onaudioprocess = function(e){

      var inputLength = e.inputBuffer.length
      var outputLength = e.inputBuffer.length
      var inputL = e.inputBuffer.getChannelData(0)
      var inputR = e.inputBuffer.getChannelData(1)
      var output = e.outputBuffer.getChannelData(0)

      var rms = 0;
      targetValue = 0

      for (var i=0;i<inputLength;i++){
        targetValue += (Math.abs(inputL[i]) + Math.abs(inputR[i])) / 2
      }

      targetValue = (targetValue / inputLength) * 2

      for (var i=0;i<outputLength;i++){
        var difference = lastValue - targetValue
        if (difference > 0){
          lastValue = lastValue - difference * 0.001 // release
        } else {
          lastValue = lastValue - difference * 0.001 // attack
        }
        output[i] = Math.max(-1, -lastValue)
      }

    }

    var pump = audioContext.createGain()
    pump.gain.value = 0
    pump.connect(audioContext.destination)
    audioContext.globalDipperProcessor.connect(pump)

  }
  return audioContext.globalDipperProcessor
}