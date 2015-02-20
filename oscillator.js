var Observ = require('observ')
var computed = require('observ/computed')
var watch = require('observ/watch')

var ObservStruct = require('observ-struct')
var Param = require('./param.js')
var Prop = require('./prop.js')

module.exports = Oscillator

function Oscillator(context){

  var targets = []

  var oscillator = context.audio.createOscillator()
  var power = context.audio.createGain()
  var amp = context.audio.createGain()
  var choker = context.audio.createGain()
  var output = context.audio.createGain()

  oscillator.connect(power)
  choker.gain.value = 0

  power.connect(amp)
  amp.connect(choker)

  oscillator.start()

  context.scheduler.on('data', onSchedule)

  var obs = ObservStruct({
    amp: Param(context, amp.gain, 1),
    noteOffset: Prop(0),
    octave: Prop(0),
    detune: Param(context, oscillator.detune, 0),
    shape: Prop('sine') //Param(context, multiplier.gain, 1)
  })

  var hasTriggered = false
  var releaseNoteOffset = null
  var globalOffset = Prop(0)

  if (context.noteOffset){
    releaseNoteOffset = watch(context.noteOffset, globalOffset.set)
  }

  obs.context = context

  obs.shape(function(shape){
    oscillator.type = shape
  })

  var frequency = computed([obs.noteOffset, globalOffset, obs.octave], function(noteOffset, globalOffset, octave){
    return 440 * Math.pow(2, ((noteOffset + globalOffset) / 12) + octave)
  })

  var maxTime = null
  var lastOn = -1
  var lastOff = 0

  watch(frequency, function(value){
    var oldValue = oscillator.frequency.value
    oscillator.frequency.value = value

    power.gain.value = 1 - ((value / 20000) || 0)

    if (oldValue !== value && hasTriggered){
      var to = context.audio.currentTime + 0.2
      choker.connect(output)
      if ((!maxTime || maxTime < to) && lastOn < lastOff){
        maxTime = to
      }
    }

  })

  obs.getReleaseDuration = function(){
    return Math.max(obs.amp.getReleaseDuration(), obs.detune.getReleaseDuration())
  }


  obs.triggerOn = function(at){
    at = Math.max(at||0, context.audio.currentTime)
    choker.connect(output)
    choker.gain.cancelScheduledValues(at)
    choker.gain.setValueAtTime(1, at)
    obs.amp.triggerOn(at)
    obs.detune.triggerOn(at)
    maxTime = null
    hasTriggered = true

    if (lastOn < at){
      lastOn = at
    }
  }

  obs.triggerOff = function(at){
    at = Math.max(at||0, context.audio.currentTime)
    var stopAt = obs.getReleaseDuration() + at

    obs.amp.triggerOff(stopAt - obs.amp.getReleaseDuration())
    obs.detune.triggerOff(stopAt - obs.amp.getReleaseDuration())
    choker.gain.setValueAtTime(0, stopAt)

    if (stopAt > maxTime){
      maxTime = stopAt
    }

    if (lastOff < at){
      lastOff = at
    }
  }

  obs.destroy = function(){
    releaseNoteOffset&&releaseNoteOffset()
    releaseNoteOffset = null
    context.scheduler.removeListener('data', onSchedule)
  }

  obs.connect = output.connect.bind(output)
  obs.disconnect = output.disconnect.bind(output)

  return obs

  //

  function onSchedule(schedule){
    if (maxTime && context.audio.currentTime > maxTime){
      maxTime = null
      choker.disconnect()
    }
  }
}