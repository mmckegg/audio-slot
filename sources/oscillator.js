var Observ = require('observ')
var computed = require('observ/computed')
var watch = require('observ/watch')

var ObservStruct = require('observ-struct')

var Transform = require('../modulators/transform.js')
var Apply = require('../modulators/apply.js')

var Param = require('../param.js')
var Property = require('../property.js')

module.exports = OscillatorNode

function OscillatorNode(context){

  var targets = []

  var oscillator = context.audio.createOscillator()
  var power = context.audio.createGain()
  var amp = context.audio.createGain()
  var choker = context.audio.createGain()
  var output = context.audio.createGain()

  oscillator.connect(power)
  choker.gain.value = 0
  amp.gain.value = 0

  power.connect(amp)
  amp.connect(choker)

  oscillator.start()

  var releaseSchedule = context.scheduler.onSchedule(handleSchedule)

  var obs = ObservStruct({
    amp: Param(context, 1),
    noteOffset: Param(context, 0),
    octave: Param(context, 0),
    detune: Param(context, 0),
    shape: Property('sine') //Param(context, multiplier.gain, 1)
  })


  var maxTime = null
  var lastOn = -1
  var lastOff = 0
  var hasTriggered = false

  obs.context = context

  Apply(context, amp.gain, obs.amp)
  Apply(context, oscillator.detune, obs.detune)

  var frequency = Transform(context, [ 440,
    { param: obs.octave, transform: transformOctave },
    { param: obs.noteOffset, transform: transformNote },
    { param: context.noteOffset, transform: transformNote }
  ])

  var powerRolloff = Transform(context, [
    { param: frequency, transform: frequencyToPowerRolloff }
  ])

  Apply(context, oscillator.frequency, frequency)
  Apply(context, power.gain, powerRolloff)

  obs.shape(function(shape){
    oscillator.type = shape
  })

  obs.getReleaseDuration = Param.getReleaseDuration.bind(this, obs)

  obs.triggerOn = function(at){
    at = at || context.audio.currentTime
    choker.connect(output)
    choker.gain.cancelScheduledValues(at)
    choker.gain.setValueAtTime(1, at)

    // start modulators
    Param.triggerOn(obs, at)

    maxTime = null
    hasTriggered = true

    if (lastOn < at){
      lastOn = at
    }
  }

  obs.triggerOff = function(at){
    at = at || context.audio.currentTime
    var stopAt = obs.getReleaseDuration() + at

    // stop modulators
    Param.triggerOff(obs, stopAt)

    choker.gain.setValueAtTime(0, stopAt)

    if (stopAt > maxTime){
      maxTime = stopAt
    }

    if (lastOff < at){
      lastOff = at
    }
  }

  obs.destroy = function(){
    
    // release context.noteOffset
    frequency.destroy()

    releaseSchedule&&releaseSchedule()
    releaseSchedule = null
  }

  obs.connect = output.connect.bind(output)
  obs.disconnect = output.disconnect.bind(output)

  return obs

  //

  function handleSchedule(schedule){
    if (maxTime && context.audio.currentTime > maxTime){
      maxTime = null
      choker.disconnect()
    }
  }

  function flush(at){
    if (hasTriggered){
      var to = at + 0.2
      choker.connect(output)
      if ((!maxTime || maxTime < to) && lastOn < lastOff){
        maxTime = to
      }
    }
  }
}

function transformOctave(baseFrequency, value){
  return baseFrequency * Math.pow(2, value)
}

function transformNote(baseFrequency, value){
  return baseFrequency * Math.pow(2, value / 12)
}

function frequencyToPowerRolloff(baseValue, value){
  return 1 - ((value / 20000) || 0)
}
