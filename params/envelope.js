var ObservStruct = require('observ-struct')
var Property = require('observ-default')
var Event = require('geval')

var Param = require('audio-slot-param')
var Transform = require('audio-slot-param/transform')
var setImmediate = require('setimmediate2').setImmediate

module.exports = Envelope

function Envelope (context) {
  var obs = ObservStruct({
    attack: Param(context, 0),
    decay: Param(context, 0),
    release: Param(context, 0),
    sustain: Param(context, 1),
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
    { param: eventSource, transform: multiply, watchingYou: true }
  ])

  obs.getValueAt = outputValue.getValueAt
  obs.onSchedule = outputValue.onSchedule

  obs.context = context

  obs.triggerOn = function (at) {
    at = Math.max(at, context.audio.currentTime)

    var peakTime = at + (obs.attack() || 0.005)

    if (obs.attack()) {
      broadcast({
        value: 1,
        at: at,
        duration: obs.attack.getValueAt(at),
        mode: 'log'
      })
    } else {
      broadcast({ value: 1, at: at })
    }

    // decay / sustain
    broadcast({
      value: obs.sustain.getValueAt(peakTime),
      at: peakTime,
      duration: obs.decay.getValueAt(peakTime),
      mode: 'log'
    })
  }

  obs.triggerOff = function (at) {
    at = Math.max(at, context.audio.currentTime)

    var releaseTime = obs.release.getValueAt(at)

    // release
    if (releaseTime) {
      broadcast({
        value: 0, at: at,
        duration: releaseTime,
        mode: 'log'
      })
    } else {
      broadcast({ value: 0, at: at })
    }

    return at + releaseTime
  }

  obs.cancelFrom = function (at) {
    at = Math.max(at, context.audio.currentTime)
    broadcast({ mode: 'cancel', at: at })
  }

  obs.getReleaseDuration = function () {
    return obs.release.getValueAt(context.audio.currentTime)
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
