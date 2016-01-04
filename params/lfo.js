var Observ = require('observ')
var ObservStruct = require('observ-struct')
var Property = require('observ-default')
var Event = require('geval')

var Param = require('audio-slot-param')
var Transform = require('audio-slot-param/transform')
var applyScheduler = require('../lib/apply-scheduler')

module.exports = LFO

function LFO (context) {
  var releaseSchedule = applyScheduler(context, handleSchedule)
  var active = []
  var scheduledTo = 0
  var lastBeatDuration = 1

  var free = {
    start: context.audio.currentTime,
    nextTime: context.audio.currentTime
  }

  var obs = ObservStruct({
    mode: Property('multiply'),
    sync: Property(false),
    trigger: Property(true),

    phaseOffset: Observ(),
    rate: Param(context, 1),
    amp: Param(context, 1),
    value: Param(context, 1),

    curve: Param(context, 0.5),
    skew: Param(context, 0)
  })

  obs.trigger(function (value) {
    if (!value) {
      free.nextTime = context.audio.currentTime
    }
  })

  obs.context = context

  var broadcast = null
  var eventSource = {
    onSchedule: Event(function (b) {
      broadcast = b
    }),

    getValueAt: function (at) {
      return 0
    }
  }

  var transform = Transform(context, [
    { param: eventSource },
    { param: obs.amp, transform: multiply },
    { param: obs.value, transform: operation }
  ])

  obs.getValueAt = transform.getValueAt
  obs.onSchedule = transform.onSchedule
  obs.getReleaseDuration = Param.getReleaseDuration.bind(this, obs)

  obs.triggerOn = function (at) {
    if (obs.trigger()) {
      at = at || context.audio.currentTime

      var event = {
        start: at,
        end: null,
        nextTime: at
      }

      truncate(at)

      Param.triggerOn(obs, at)

      active.push(event)

      broadcast({
        at: at,
        value: 0
      })

      if (at < scheduledTo) {
        scheduleEvent(event, at, scheduledTo, lastBeatDuration)
      }
    }
  }

  obs.triggerOff = function (at) {
    at = at || context.audio.currentTime
    var event = eventAt(at)
    if (event) {
      var stopAt = obs.getReleaseDuration() + at
      Param.triggerOff(obs, stopAt)
      truncate(stopAt)

      broadcast({
        at: stopAt,
        value: 0
      })

      event.end = stopAt
    }

  }

  obs.destroy = function () {
    releaseSchedule && releaseSchedule()
    releaseSchedule = null
  }

  return obs

  // scoped

  function handleSchedule (schedule) {
    var from = schedule.time
    var to = schedule.time + schedule.duration

    for (var i = active.length - 1;i >= 0;i--) {
      var event = active[i]

      // clean up old events
      if (event.end && event.end < context.audio.currentTime) {
        active.splice(i, 1)
        continue
      }

      scheduleEvent(event, from, to, schedule.beatDuration)
    }

    if (!obs.trigger() && (!context.active || context.active())) {
      scheduleEvent(free, from, to, schedule.beatDuration)
    }

    lastBeatDuration = schedule.beatDuration
    scheduledTo = to
  }

  function scheduleEvent (event, from, to, beatDuration) {
    if (event.nextTime < from) {
      event.nextTime = from
    }

    if (event.start <= from && (!event.end || event.end > to)) {
      var rate = obs.rate.getValueAt(from)

      if (obs.sync()) {
        rate = rate / beatDuration
      }

      var duration = 1 / rate

      while (event.nextTime < to) {
        step(event.nextTime, duration)

        event.nextTime += duration
        if (obs.mode() !== 'oneshot') {
          event.nextOffset = event.nextOffset % 1
        }
      }
    }
  }

  function step (start, duration) {
    var skew = clamp((obs.skew.getValueAt(start) + 1) / 2, 0, 0.999999999)
    var curve = clamp(obs.curve.getValueAt(start), 0, 1)

    var stepDuration = duration / 4
    var up = stepDuration * skew * curve
    var down = stepDuration * (1 - skew) * curve
    var mid = start + (duration * skew)
    var end = start + duration

    broadcast({
      at: start,
      value: 1,
      duration: up
    })

    broadcast({
      at: mid - down,
      value: 0,
      duration: down
    })

    broadcast({
      at: mid + up,
      value: -1,
      duration: up
    })

    broadcast({
      at: end - down,
      value: 0,
      duration: down
    })

  }

  function operation (base, value) {
    var mode = obs.mode()
    if (mode === 'add') {
      return base + value
    } else if (mode === 'subtract') {
      return value - base
    } else {
      return base * value
    }
  }

  function truncate (at) {
    for (var i = active.length - 1;i >= 0;i--) {
      if (active[i].start >= at) {
        active.splice(i, 1)
      } else if (active[i].end && active[i].end > at) {
        active[i].end = at
      }
    }
  }

  function eventAt (time) {
    for (var i = 0;i < active.length;i++) {
      if (active[i].start <= time && (!active[i].end || active[i].end > time)) {
        return active[i]
      }
    }
  }
}

function clamp (value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function multiply (a, b) {
  return a * b
}
