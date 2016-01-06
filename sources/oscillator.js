var ObservStruct = require('observ-struct')

var Param = require('audio-slot-param')
var Transform = require('audio-slot-param/transform')
var Apply = require('audio-slot-param/apply')
var applyScheduler = require('../lib/apply-scheduler')

var Property = require('observ-default')

module.exports = OscillatorNode

function OscillatorNode (context) {
  var oscillator = null
  var power = context.audio.createGain()
  var amp = context.audio.createGain()
  var choker = context.audio.createGain()
  var output = context.audio.createGain()

  choker.gain.value = 0
  amp.gain.value = 0

  power.connect(amp)
  amp.connect(choker)

  var releaseSchedule = applyScheduler(context, handleSchedule)
  var releaseSync = []

  var obs = ObservStruct({
    amp: Param(context, 1),
    frequency: Param(context, 440),
    noteOffset: Param(context, 0),
    octave: Param(context, 0),
    detune: Param(context, 0),
    shape: Property('sine') // Param(context, multiplier.gain, 1)
  })

  var maxTime = null
  var lastOn = -1
  var lastOff = 0

  obs.context = context

  var frequency = Transform(context, [
    { param: obs.frequency },
    { param: obs.octave, transform: transformOctave },
    { param: obs.noteOffset, transform: transformNote },
    { param: context.noteOffset, transform: transformNote }
  ])

  var powerRolloff = Transform(context, [
    { param: frequency, transform: frequencyToPowerRolloff }
  ])

  Apply(context, amp.gain, obs.amp)
  Apply(context, power.gain, powerRolloff)

  obs.shape(refreshShape)

  obs.getReleaseDuration = Param.getReleaseDuration.bind(this, obs)

  obs.choke = function (at) {
    if (choker) {
      choker.gain.setTargetAtTime(0, at, 0.02)
    }
  }

  obs.triggerOn = function (at) {
    at = at || context.audio.currentTime
    choker.connect(output)
    choker.gain.cancelScheduledValues(at)
    choker.gain.setValueAtTime(1, at)

    // start modulators
    Param.triggerOn(obs, at)

    maxTime = null

    if (lastOn < at) {
      lastOn = at
    }
  }

  obs.triggerOff = function (at) {
    at = at || context.audio.currentTime
    var stopAt = obs.getReleaseDuration() + at

    // stop modulators
    Param.triggerOff(obs, stopAt)

    choker.gain.setValueAtTime(0, stopAt)

    if (stopAt > maxTime) {
      maxTime = stopAt
    }

    if (lastOff < at) {
      lastOff = at
    }
  }

  obs.destroy = function () {
    // release context.noteOffset
    frequency.destroy()
    releaseSchedule && releaseSchedule()
    releaseSchedule = null
  }

  obs.connect = output.connect.bind(output)
  obs.disconnect = output.disconnect.bind(output)

  resync()
  return obs

  //

  function handleSchedule (schedule) {
    if (maxTime && context.audio.currentTime > maxTime) {
      maxTime = null
      choker.disconnect()
      resync()
    }
  }

  function resync () {
    while (releaseSync.length) {
      releaseSync.pop()()
    }

    if (oscillator) {
      oscillator.disconnect()
    }

    oscillator = context.audio.createOscillator()
    oscillator.lastShape = 'sine'

    refreshShape()
    oscillator.connect(power)
    oscillator.start()

    releaseSync.push(
      Apply(context, oscillator.detune, obs.detune),
      Apply(context, oscillator.frequency, frequency)
    )
  }

  function refreshShape () {
    var shape = obs.shape()
    if (shape !== oscillator.lastShape) {
      if (context.periodicWaves && context.periodicWaves[shape]) {
        oscillator.setPeriodicWave(context.periodicWaves[shape])
      } else {
        oscillator.type = shape
      }
      oscillator.lastShape = shape
    }
  }
}

function transformOctave (baseFrequency, value) {
  return baseFrequency * Math.pow(2, value)
}

function transformNote (baseFrequency, value) {
  return baseFrequency * Math.pow(2, value / 12)
}

function frequencyToPowerRolloff (baseValue, value) {
  return 1 - ((value / 20000) || 0)
}
