var ObservStruct = require('observ-struct')
var Param = require('audio-slot-param')
var ScheduleList = require('./lib/schedule-list')

module.exports = Triggerable

function Triggerable (context, params, trigger) {
  var scheduled = ScheduleList()

  var obs = ObservStruct(params)

  obs.getReleaseDuration = Param.getReleaseDuration.bind(this, obs)

  obs.triggerOn = function (at) {
    obs.choke(at)
    var event = trigger(at)
    if (event) {
      scheduled.push(event)
      Param.triggerOn(obs, at)

      if (event.to) {
        var stopAt = Math.max(at + obs.getReleaseDuration(), event.to)
        event.stop(stopAt)
        Param.triggerOff(obs, stopAt + 0.0001)
      }
    }
  }

  obs.triggerOff = function (at) {
    at = at || context.audio.currentTime
    scheduled.truncateTo(context.audio.currentTime)
    scheduled.truncateFrom(at)
    var event = scheduled.getLast()
    if (event) {
      if (!event.oneshot) {
        var stopAt = obs.getReleaseDuration() + at
        event.stop(stopAt)
        Param.triggerOff(obs, stopAt)
      } else {
        event.cancelChoke()
      }
    }
  }

  obs.cancelFrom = function (at) {
    scheduled.truncateTo(context.audio.currentTime)
    scheduled.truncateFrom(at)

    var event = scheduled.getLast()
    if (event) {
      Param.cancelFrom(obs, at)
      event.cancelChoke()
    }
  }

  obs.choke = function (at) {
    scheduled.truncateTo(context.audio.currentTime)
    scheduled.truncateFrom(at)

    var event = scheduled.getLast()
    if (event) {
      event.choke(at)
    }
  }

  return obs
}
