var Observ = require('observ')
var ObservStruct = require('observ-struct')
var Param = require('./param.js')
var Prop = require('./prop.js')

module.exports = Envelope

function Envelope(context){

  var targets = []

  var obs = ObservStruct({
    attack: Prop(0),
    decay: Prop(0),
    sustain: Prop(1),
    release: Prop(0),
    value: Prop(1) //Param(context, multiplier.gain, 1)
  })

  var hasTriggered = false

  obs.context = context

  obs.triggerOn = function(at){
    at = Math.max(at||0, context.audio.currentTime)

    var peakTime = at + (obs.attack() || 0.005)

    for (var i=0;i<targets.length;i++){
      var target = targets[i]

      // attack
      target.cancelScheduledValues(at)

      if (!hasTriggered){
        target.setValueAtTime(0, at)
      }

      if (obs.attack()){
        target.setTargetAtTime(obs.value(), at, getTimeConstant(obs.attack()))
      } else {
        target.setValueAtTime(obs.value(), at)
      }

      // decay / sustain
      target.setTargetAtTime(obs.sustain()*obs.value(), peakTime, getTimeConstant(obs.decay()))
    }

    hasTriggered = true
  }

  obs.triggerOff = function(at){
    at = Math.max(at||0, context.audio.currentTime)

    for (var i=0;i<targets.length;i++){
      var target = targets[i]

      // release
      target.cancelScheduledValues(at)
      target.setTargetAtTime(0, at, getTimeConstant(obs.release()/2))
    }

    return at + obs.release()
  }

  obs.getReleaseDuration = function(){
    return obs.release()
  }

  obs.connect = function(t){
    targets.push(t)
  } 

  obs.disconnect = function(){
    targets.length = 0
  }
  return obs
}

function getTimeConstant(time){
  return time / 4
}

function getValue(start, end, fromTime, toTime, at){
  var difference = end - start
  var time = toTime - fromTime
  var truncateTime = at - fromTime
  var phase = truncateTime / time
  return start + phase * difference
}