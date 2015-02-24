var Observ = require('observ')
var ObservStruct = require('observ-struct')
var Param = require('../param.js')
var Prop = require('../prop.js')
var Event = require('geval')

module.exports = Envelope

function Envelope(context){

  var obs = ObservStruct({
    attack: Prop(0),
    decay: Prop(0),
    sustain: Prop(1),
    release: Prop(0),
    value: Prop(1) //Param(context, multiplier.gain, 1)
  })

  var broadcast = null
  obs.onSchedule = Event(function(b){
    broadcast = b
  })

  obs.context = context

  obs.triggerOn = function(at){
    at = Math.max(at||0, context.audio.currentTime)

    var peakTime = at + (obs.attack() || 0.005)

    broadcast({ mode: 'init', value: 0, at: at })

    if (obs.attack()){
      broadcast({ 
        value: obs.value(), 
        at: at, 
        duration: obs.attack(), 
        mode: 'log' 
      })
    } else {
      broadcast({ value: obs.value(), at: at })
    }

    // decay / sustain
    broadcast({ 
      value: obs.sustain()*obs.value(), 
      at: peakTime, 
      duration: obs.decay(), 
      mode: 'log' 
    })
  }

  obs.triggerOff = function(at){
    at = Math.max(at||0, context.audio.currentTime)

    // release
    broadcast({ 
      value: 0, at: at, 
      duration: obs.release(), 
      mode: 'log' 
    })

    return at + obs.release()
  }

  obs.getReleaseDuration = function(){
    return obs.release()
  }

  return obs
}

function getValue(start, end, fromTime, toTime, at){
  var difference = end - start
  var time = toTime - fromTime
  var truncateTime = at - fromTime
  var phase = truncateTime / time
  return start + phase * difference
}