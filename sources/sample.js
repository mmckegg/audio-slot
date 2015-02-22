var Observ = require('observ')
var watch = require('observ/watch')
var computed = require('observ/computed')

var ObservStruct = require('observ-struct')
var Transform = require('../transform.js')
var Node = require('observ-node-array/single')
var Param = require('../param.js')
var Prop = require('../prop.js')

var ResolvedValue = require('../resolved-value')

module.exports = SampleNode

function SampleNode(context){

  var output = context.audio.createGain()

  var obs = ObservStruct({

    mode: Prop('hold'),
    offset: Prop([0,1]),
    buffer: Node(context),

    amp: Param(context, 1),
    transpose: Param(context, 0),
    tune: Param(context, 0)

  })

  obs.resolvedBuffer = ResolvedValue(obs.buffer)

  var releaseNoteOffset = null
  var globalOffset = Prop(0)
  if (context.noteOffset){
    releaseNoteOffset = watch(context.noteOffset, globalOffset.set)
  }

  obs.context = context

  var player = null
  var choker = null
  var amp = null

  var releaseAmp = null
  var releaseRate = null
  var playTo = false

  var triggerOnRelease = false
  var isOneshot = false

  var rateTransforms = [
    { param: globalOffset, transform: noteOffsetToRate },
    { param: obs.transpose, transform: noteOffsetToRate },
    { param: obs.tune, transform: centsToRate },
  ]

  obs.offset(function(value){
    var buffer = obs.resolvedBuffer()
    if (buffer && player && Array.isArray(value)){
      player.loopStart = buffer.duration * value[0]
      player.loopEnd = buffer.duration * value[1]
    }
  })

  obs.choke = function(at){
    stop(at+(0.02*6))
    if (choker && at < playTo){
      choker.gain.setTargetAtTime(0, at, 0.02)
    }
  }

  obs.triggerOn = function(at){
    obs.choke(at)

    var mode = obs.mode()
    var buffer = obs.resolvedBuffer()
 
    if (buffer instanceof AudioBuffer){
      playTo = null
      choker = context.audio.createGain()
      amp = context.audio.createGain()
      player = context.audio.createBufferSource()

      releaseAmp = Transform(context, amp.gain, [ obs.amp ])
      releaseRate = Transform(context, player.playbackRate, rateTransforms)

      player.connect(amp)
      amp.connect(choker)
      choker.connect(output)

      player.buffer = buffer
      player.loopStart = buffer.duration * obs.offset()[0]
      player.loopEnd = buffer.duration * obs.offset()[1]

      if (mode === 'loop'){
        player.loop = true
        player.start(at, player.loopStart, 1000)
        Param.triggerOn(obs, at)
      } else if (mode === 'release'){
        triggerOnRelease = true
      } else if (mode === 'oneshot'){
        player.start(at, player.loopStart, player.loopEnd - player.loopStart)
        Param.triggerOn(obs, at)

        var stopAt = obs.triggerOff(at + player.loopEnd - player.loopStart - obs.getReleaseDuration())
        isOneshot = true
        return stopAt
      } else {
        player.start(at, player.loopStart, player.loopEnd - player.loopStart)
        Param.triggerOn(obs, at)
      }
    }
  }

  obs.triggerOff = function(at){
    if (isOneshot){
      isOneshot = false
    } else {
      at = Math.max(at||0, context.audio.currentTime)
      var stopAt = obs.getReleaseDuration() + at

      if (triggerOnRelease){
        Param.triggerOn(obs, at)
        player.start(at, player.loopStart, player.loopEnd - player.loopStart)
        stopAt += player.loopEnd - player.loopStart
        triggerOnRelease = false
      }

      Param.triggerOff(obs, stopAt)
      stop(stopAt)
    }
  }

  obs.getReleaseDuration = Param.getReleaseDuration.bind(this, obs)
  obs.connect = output.connect.bind(output)
  obs.disconnect = output.disconnect.bind(output)

  return obs

  // scoped

  function stop(at){
    if (!playTo && player){
      playTo = at
      player.stop(at)
      releaseAmp()
      releaseRate()
    }
  }
}

function noteOffsetToRate(baseRate, value){
  return baseRate * Math.pow(2, value / 12)
}

function centsToRate(baseRate, value){
  return baseRate * Math.pow(2, value / 1200)
}