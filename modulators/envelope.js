var Observ = require('observ')
var ObservStruct = require('observ-struct')
var Param = require('../param.js')
var Property = require('../property.js')
var Event = require('geval')

module.exports = Envelope

function Envelope(context){

  var obs = ObservStruct({
    attack: Property(0),
    decay: Property(0),
    sustain: Property(1),
    release: Property(0),
    value: Property(1) //Param(context, multiplier.gain, 1)
  })

  var broadcast = null
  obs.onSchedule = Event(function(b){
    broadcast = b
  })

  obs.context = context

  obs.triggerOn = function(at){
    at = at||context.audio.currentTime

    var peakTime = at + (obs.attack() || 0.005)

    if (obs.release() && obs.attack()){
      broadcast({ mode: 'init', value: 0, at: at })
    } else {
      broadcast({ value: 0, at: at })
    }

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
    at = at||context.audio.currentTime

    // release
    if (obs.release()){
      broadcast({ 
        value: 0, at: at, 
        duration: obs.release(), 
        mode: 'log' 
      })
    }

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