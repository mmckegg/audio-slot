var ObservStruct = require('observ-struct')
var Node = require('observ-node-array/single')
var Property = require('observ-default')

var Param = require('audio-slot-param')
var Transform = require('audio-slot-param/transform')
var Apply = require('audio-slot-param/apply')

var ResolvedValue = require('observ-node-array/resolved-value')
var SyncProperty = require('../lib/granular-sync')
var applyScheduler = require('../lib/apply-scheduler')

module.exports = GranularNode

function GranularNode (context) {
  var output = context.audio.createGain()
  var releaseSchedule = applyScheduler(context, handleSchedule)

  var offset = Property([0, 1])
  var buffer = Node(context)
  var resolvedBuffer = ResolvedValue(buffer)
  var duration = Property(1)
  var sync = SyncProperty(duration, offset, resolvedBuffer)

  var obs = ObservStruct({
    mode: Property('loop'),

    sync: sync,
    offset: offset,
    buffer: buffer,
    duration: duration,

    rate: Property(8),

    attack: Property(0.1),
    hold: Property(1),
    release: Property(0.1),

    transpose: Param(context, 0),
    tune: Param(context, 0),
    amp: Param(context, 1)
  })

  Apply(context, output.gain, obs.amp)

  obs.context = context

  var playbackRate = Transform(context, [ 1,
    { param: context.noteOffset, transform: noteOffsetToRate },
    { param: obs.transpose, transform: noteOffsetToRate },
    { param: obs.tune, transform: centsToRate }
  ])

  obs.resolvedBuffer = resolvedBuffer

  var active = []
  var scheduledTo = 0
  var lastBeatDuration = 1

  obs.choke = function (at) {
    at = at || context.audio.currentTime
    var event = eventAt(at - 0.02)
    if (event) {
      var stopAt = at + (0.02 * 6)
      event.output.gain.setTargetAtTime(0, at, 0.02)
      event.end = stopAt
    }
  }

  obs.triggerOn = function (at) {
    obs.choke(at)

    var amp = context.audio.createGain()
    amp.connect(output)

    var stopAt = null
    var event = {
      start: at,
      end: null,
      nextTime: at,
      nextOffset: 0,
      output: amp
    }

    if (obs.mode() === 'oneshot') {
      event.oneshot = true
      var duration = obs.sync() ? obs.duration() * lastBeatDuration : obs.duration()
      stopAt = at + duration
      Param.triggerOff(obs, stopAt)
      truncate(stopAt)
      event.end = stopAt
    }

    at = at || context.audio.currentTime
    truncate(at)

    Param.triggerOn(obs, at)

    active.push(event)

    if (at < scheduledTo) {
      scheduleEvent(event, at, scheduledTo, lastBeatDuration)
    }

    return stopAt
  }

  obs.triggerOff = function (at) {
    at = at || context.audio.currentTime
    var event = eventAt(at)
    if (event && !event.oneshot) {
      var stopAt = obs.getReleaseDuration() + at
      Param.triggerOff(obs, stopAt)
      truncate(stopAt)
      event.end = stopAt
    }
  }

  obs.destroy = function () {
    // release context.noteOffset
    playbackRate.destroy()

    releaseSchedule && releaseSchedule()
    releaseSchedule = null
  }

  obs.getReleaseDuration = Param.getReleaseDuration.bind(this, obs)
  obs.connect = output.connect.bind(output)
  obs.disconnect = output.disconnect.bind(output)

  return obs

  // scoped

  function handleSchedule (schedule) {
    var from = schedule.time
    var to = schedule.time + schedule.duration

    for (var i = active.length - 1;i >= 0;i--) {
      var event = active[i]

      // clean up old events
      if (event.end && event.end < context.audio.currentTime) {
        event.output.disconnect()
        active.splice(i, 1)
        continue
      }

      scheduleEvent(event, from, to, schedule.beatDuration)
    }

    lastBeatDuration = schedule.beatDuration
    scheduledTo = to
  }

  function scheduleEvent (event, from, to, beatDuration) {
    if (event.start <= from && (!event.end || event.end > to)) {
      var length = obs.duration()
      var rate = obs.rate()

      if (obs.sync()) {
        length = length * beatDuration
        rate = rate / beatDuration
      }

      var slices = Math.max(1, rate) * length
      var duration = length / slices

      while (event.nextTime < to) {
        play(event.output, event.nextTime, event.nextOffset, duration)

        event.nextTime += duration
        event.nextOffset += 1 / slices
        if (obs.mode() !== 'oneshot') {
          event.nextOffset = event.nextOffset % 1
        }
      }
    }
  }

  function play (output, at, startOffset, grainDuration) {
    var event = eventAt(at)

    var buffer = obs.resolvedBuffer()
    if (buffer instanceof window.AudioBuffer) {
      var source = context.audio.createBufferSource()
      source.buffer = buffer

      var offset = obs.offset()
      var start = offset[0] * source.buffer.duration
      var end = offset[1] * source.buffer.duration
      var duration = end - start

      var release = grainDuration * obs.release()
      var attack = grainDuration * obs.attack()

      // make sure it doesn't exceed the stop time
      var maxTime = (event && event.end || Infinity) - release
      var releaseAt = Math.min(at + grainDuration * obs.hold(), maxTime)

      source.playbackRate.value = playbackRate.getValueAt(at)

      if (obs.mode() !== 'oneshot' && releaseAt + release > startOffset * duration) {
        source.loop = true
        source.loopStart = start
        source.loopEnd = end
      }

      source.start(at, startOffset * duration + start)
      source.stop(releaseAt + release)

      var envelope = context.audio.createGain()
      source.connect(envelope)

      // envelope
      if (attack) {
        envelope.gain.setValueAtTime(0, at)
        envelope.gain.linearRampToValueAtTime(1, Math.min(attack, grainDuration) + at)
      }
      envelope.gain.setValueAtTime(1, releaseAt)
      envelope.gain.linearRampToValueAtTime(0, releaseAt + release)

      envelope.connect(output)
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

function noteOffsetToRate (baseRate, value) {
  return baseRate * Math.pow(2, value / 12)
}

function centsToRate (baseRate, value) {
  return baseRate * Math.pow(2, value / 1200)
}
