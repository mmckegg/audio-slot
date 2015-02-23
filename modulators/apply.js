var interpolate = require('./interpolate.js')

module.exports = ApplyParam

function ApplyParam(context, target, param){

  var release = null 
  var lastValue = null
  var currentTime = context.audio.currentTime
  var events = []
  var maxSchedule = 0

  if (param.onSchedule){
    release = param.onSchedule(schedule)

    if (param.getValueAt){
      lastValue = param.getValueAt(currentTime)
    } else if (param.getValue){
      lastValue = param.getValue()
    }

  } else if (typeof param === 'function'){
    release = param(schedule)
    lastValue = param()
  }

  if (currentTime != null){
    target.setValueAtTime(lastValue, currentTime)
  }

  return release

  // scoped
  function schedule(descriptor){

    if (!(descriptor instanceof Object)){
      descriptor = { value: descriptor, at: context.audio.currentTime }
    }

    var toTime = descriptor.at + (descriptor.duration || 0)
    lastValue = descriptor.value

    var fromValue = getValueAt(descriptor.at)

    descriptor.fromValue = descriptor.fromValue != null ? 
      descriptor.fromValue : 
      fromValue


    if (descriptor.duration){

      if (maxSchedule > descriptor.at){
        target.cancelScheduledValues(descriptor.at)
        maxSchedule = descriptor.at
      }

      if (isRampingAt(descriptor.at)){
        target.setValueAtTime(fromValue, descriptor.at)
      }

      truncate(descriptor.at)
      events.push(descriptor)

      if (descriptor.mode === 'exp'){
        target.exponentialRampToValueAtTime(descriptor.value, toTime)
      } else if (descriptor.mode === 'log'){
        target.setTargetAtTime(descriptor.value, descriptor.at, descriptor.duration / 8)
      } else {
        target.linearRampToValueAtTime(descriptor.value, toTime)
      }
    } else if (descriptor.mode !== 'init' || !maxSchedule) {
      truncate(descriptor.at)
      events.push(descriptor)

      target.cancelScheduledValues(descriptor.at)
      target.setValueAtTime(descriptor.value, descriptor.at)
      maxSchedule = descriptor.at
    }

    if (maxSchedule < toTime){
      maxSchedule = toTime
    }
  }

  function truncate(at){
    var currentTime = context.audio.currentTime
    for (var i=events.length-1;i>=0;i--){
      var to = events[i].at + (events[i].duration || 0)
      if (events[i].at > at || to < currentTime){
        events.splice(i, 1)
      }
    }
  }

  function getEndTime(){
    var lastEvent = events[events.length-1]
    if (lastEvent){
      return lastEvent.at + (lastEvent.duration || 0)
    }
  }

  function getValueAt(time){
    for (var i=0;i<events.length;i++){
      var event = events[i]
      var next = events[i+1]
      if (!next || next.at > time){
        return interpolate(event, time)
      }
    }
    return lastValue
  }

  function isRampingAt(time){
    for (var i=0;i<events.length;i++){
      if (event.at >= time && (event.at + event.duration||0) <= time){
        return event.duration && event.mode !== 'log'
      }
    }
    return false
  }
}