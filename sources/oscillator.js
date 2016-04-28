var Triggerable = require('../triggerable')
var Param = require('audio-slot-param')
var Property = require('observ-default')
var Transform = require('audio-slot-param/transform')
var Apply = require('audio-slot-param/apply')
var watch = require('observ/watch')

var ScheduleEvent = require('../lib/schedule-event')

module.exports = OscillatorNode

function OscillatorNode (context) {
  var output = context.audio.createGain()
  var amp = context.audio.createGain()
  var power = context.audio.createGain()
  amp.gain.value = 0
  power.connect(amp)
  amp.connect(output)

  var obs = Triggerable(context, {
    amp: Param(context, 1),
    frequency: Param(context, 440),
    noteOffset: Param(context, 0),
    octave: Param(context, 0),
    detune: Param(context, 0),
    shape: Property('sine') // Param(context, multiplier.gain, 1)
  }, trigger)

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

  Apply(context, power.gain, powerRolloff)
  Apply(context, amp.gain, obs.amp)

  obs.connect = output.connect.bind(output)
  obs.disconnect = output.disconnect.bind(output)

  return obs

  // scoped
  function trigger (at) {
    var oscillator = context.audio.createOscillator()
    var choker = context.audio.createGain()
    oscillator.start(at)
    oscillator.connect(choker)
    choker.connect(amp)

    return new ScheduleEvent(at, oscillator, choker, [
      Apply(context, oscillator.detune, obs.detune),
      Apply(context, oscillator.frequency, frequency),
      ApplyShape(context, oscillator, obs.shape),
      choker.disconnect.bind(choker)
    ])
  }
}

function ApplyShape (context, target, shape) {
  return watch(shape, setShape.bind(this, context, target))
}

function setShape (context, target, value) {
  if (value !== target.lastShape) {
    if (context.periodicWaves && context.periodicWaves[value]) {
      target.setPeriodicWave(context.periodicWaves[value])
    } else {
      target.type = value
    }
    target.lastShape = value
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
