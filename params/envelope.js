var ObservStruct = require('observ-struct')
var Property = require('observ-default')
var Event = require('geval')

var Param = require('audio-slot-param')
var Transform = require('audio-slot-param/transform')
var setImmediate = require('setimmediate2').setImmediate

module.exports = Envelope

function Envelope (context) {
  var obs = ObservStruct({
    attack: Property(0),
    decay: Property(0),
    sustain: Property(1),
    release: Property(0),
    value: Param(context, 1)
  })

  var broadcast = null
  var eventSource = {
    onSchedule: Event(function (b) {
      broadcast = b
    }),
    getValueAt: function (at) {
      return 0
    }
  }

  var outputValue = Transform(context, [
    { param: obs.value },
    { param: eventSource, transform: multiply }
  ])

  obs.getValueAt = outputValue.getValueAt
  obs.onSchedule = outputValue.onSchedule

  obs.context = context

  obs.triggerOn = function (at) {
    at = Math.max(at, context.audio.currentTime)

    var peakTime = at + (obs.attack() || 0.005)

    if (obs.attack()) {
      broadcast({
        fromValue: 0,
        value: 1,
        at: at,
        duration: obs.attack(),
        mode: 'log'
      })
    } else {
      broadcast({ value: 1, at: at })
    }

    // decay / sustain
    broadcast({
      value: obs.sustain(),
      at: peakTime,
      duration: obs.decay(),
      mode: 'log'
    })
  }

  obs.triggerOff = function (at) {
    at = Math.max(at, context.audio.currentTime)

    // release
    if (obs.release()) {
      broadcast({
        value: 0, at: at,
        duration: obs.release(),
        mode: 'log'
      })
    } else {
      broadcast({ value: 0, at: at })
    }

    return at + obs.release()
  }

  obs.getReleaseDuration = function () {
    return obs.release()
  }

  setImmediate(function () {
    broadcast({
      value: 0,
      at: context.audio.currentTime
    })
  })

  return obs
}

function multiply (a, b) {
  return a * b
}
