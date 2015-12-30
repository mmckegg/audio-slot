var ObservStruct = require('observ-struct')
var Node = require('observ-node-array/single')
var Property = require('observ-default')

var Param = require('audio-slot-param')
var Transform = require('audio-slot-param/transform')
var Apply = require('audio-slot-param/apply')

var ResolvedValue = require('observ-node-array/resolved-value')

module.exports = SampleNode

function SampleNode (context) {
  var output = context.audio.createGain()

  var obs = ObservStruct({
    mode: Property('hold'),
    offset: Property([0, 1]),
    buffer: Node(context),

    amp: Param(context, 1),
    transpose: Param(context, 0),
    tune: Param(context, 0)

  })

  obs.resolvedBuffer = ResolvedValue(obs.buffer)

  obs.context = context

  var player = null
  var choker = null
  var amp = null
  var lastChoke = 0

  var releases = []
  var playTo = false

  var triggerOnRelease = false
  var isOneshot = false

  var playbackRate = Transform(context, [ 1,
    { param: context.noteOffset, transform: noteOffsetToRate },
    { param: obs.transpose, transform: noteOffsetToRate },
    { param: obs.tune, transform: centsToRate }
  ])

  obs.offset(function (value) {
    var buffer = obs.resolvedBuffer()
    if (buffer && player && Array.isArray(value)) {
      player.loopStart = buffer.duration * value[0]
      player.loopEnd = buffer.duration * value[1]
    }
  })

  obs.choke = function (at) {
    stop(at + (0.02 * 6))
    if (choker && at < playTo) {
      lastChoke = at
      choker.gain.setTargetAtTime(0, at, 0.02)
    }

    // clean up
    while (releases.length) {
      releases.pop()()
    }
  }

  obs.triggerOn = function (at) {
    obs.choke(at)

    var mode = obs.mode()
    var buffer = obs.resolvedBuffer()

    if (buffer instanceof window.AudioBuffer) {
      playTo = null
      choker = context.audio.createGain()
      amp = context.audio.createGain()
      player = context.audio.createBufferSource()

      releases.push(
        Apply(context, amp.gain, obs.amp),
        Apply(context, player.playbackRate, playbackRate)
      )

      // nice fade on retrigger (after choke)
      if (Math.abs(at - lastChoke) < 0.02) {
        choker.gain.setValueAtTime(0, at)
        choker.gain.setTargetAtTime(1, at, 0.001)
      }

      player.connect(amp)
      amp.connect(choker)
      choker.connect(output)

      player.buffer = buffer
      player.loopStart = buffer.duration * obs.offset()[0]
      player.loopEnd = buffer.duration * obs.offset()[1]
      player.onended = disconnectSelf

      if (mode === 'loop') {
        player.loop = true
        player.start(at, player.loopStart, 1000)
        Param.triggerOn(obs, at)
      } else if (mode === 'release') {
        triggerOnRelease = true
      } else if (mode === 'oneshot') {
        player.start(at, player.loopStart)
        Param.triggerOn(obs, at)

        var duration = (player.loopEnd - player.loopStart) / playbackRate.getValueAt(at)
        var maxDuration = buffer.duration - player.loopStart / playbackRate.getValueAt(at)
        var extra = Math.max(0, obs.getReleaseDuration() - maxDuration)
        obs.triggerOff(at + duration - extra)
        isOneshot = true
      } else {
        player.start(at, player.loopStart, player.loopEnd - player.loopStart)
        Param.triggerOn(obs, at)
      }
    }
  }

  obs.triggerOff = function (at) {
    if (isOneshot) {
      isOneshot = false
    } else {
      at = at || context.audio.currentTime
      var stopAt = obs.getReleaseDuration() + at

      if (triggerOnRelease) {
        Param.triggerOn(obs, at)
        player.start(at, player.loopStart, player.loopEnd - player.loopStart)
        stopAt += player.loopEnd - player.loopStart
        triggerOnRelease = false
      }

      Param.triggerOff(obs, stopAt)
      stop(stopAt)
    }
  }

  obs.destroy = function () {
    // release context.noteOffset
    playbackRate.destroy()
  }

  obs.getReleaseDuration = Param.getReleaseDuration.bind(this, obs)
  obs.connect = output.connect.bind(output)
  obs.disconnect = output.disconnect.bind(output)

  return obs

  // scoped

  function stop (at) {
    if (!playTo && player) {
      playTo = at
      player.stop(at)
    }
  }
}

function disconnectSelf () {
  this.disconnect()
}

function noteOffsetToRate (baseRate, value) {
  return baseRate * Math.pow(2, value / 12)
}

function centsToRate (baseRate, value) {
  return baseRate * Math.pow(2, value / 1200)
}
