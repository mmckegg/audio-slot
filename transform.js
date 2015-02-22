module.exports = ParamTransform

function ParamTransform(context, target, params, onSchedule){

  var releases = []
  var channels = []
  var transforms = []
  var lastValues = []

  params.forEach(function(container, i){
    if (container.onSchedule){
      container = { param: container }
    } else if (!(container instanceof Object)){
      container = { value: container }
    }

    if (container.param){

      var param = container.param
      
      if (param.onSchedule){
        releases.push(param.onSchedule(schedule.bind(this, i)))
      } else if (typeof param === 'function') {
        releases.push(param(schedule.bind(this, i)))
      }

      if (param.getValue){
        lastValues[i] = param.getValue()
      } else if (typeof param === 'function') {
        lastValues[i] = param()
      }

      channels[i] = []
    } else if (container.value){
      lastValues[i] = container.value
    }

    if (container.transform){
      transforms[i] = container.transform
    }
  })

  target.setValueAtTime(getValueAt(context.audio.currentTime), context.audio.currentTime)

  return function release(){
    while (releases.length){
      releases.pop()()
    }
  }

  // scoped

  var maxSchedule = 0

  function schedule(index, descriptor){

    if (!(descriptor instanceof Object)){
      descriptor = { value: descriptor, at: context.audio.currentTime }
    }

    var toTime = descriptor.at + (descriptor.duration || 0)
    lastValues[index] = descriptor.value

    onSchedule&&onSchedule(toTime)

    var fromValue = getValueAt(descriptor.at)

    descriptor.fromValue = descriptor.fromValue != null ? 
      descriptor.fromValue : 
      getChannelValueAt(index, descriptor.at)


    if (descriptor.duration){

      if (maxSchedule > descriptor.at){
        target.cancelScheduledValues(descriptor.at)
        maxSchedule = descriptor.at
      }

      if (isRampingAt(descriptor.at)){
        target.setValueAtTime(fromValue, descriptor.at)
      }

      truncate(index, descriptor.at)
      channels[index].push(descriptor)

      var targetValue = getValueAt(toTime)

      if (descriptor.mode === 'exp'){
        target.exponentialRampToValueAtTime(targetValue, toTime)
      } else if (descriptor.mode === 'log'){
        target.setTargetAtTime(targetValue, descriptor.at, descriptor.duration / 8)
      } else {
        target.linearRampToValueAtTime(targetValue, toTime)
      }
    } else if (descriptor.mode !== 'init' || !maxSchedule) {
      truncate(index, descriptor.at)
      channels[index].push(descriptor)
      var targetValue = getValueAt(descriptor.at)

      target.cancelScheduledValues(descriptor.at)
      target.setValueAtTime(targetValue, descriptor.at)
      maxSchedule = descriptor.at
    }

    if (maxSchedule < toTime){
      maxSchedule = toTime
    }

    var endTime = getEndTime()
    if (endTime > toTime){
      var endValue = getValueAt(endTime)
      target.linearRampToValueAtTime(endValue, endTime)
    }
  }

  function truncate(index, at){
    var events = channels[index]
    var currentTime = context.audio.currentTime
    for (var i=events.length-1;i>=0;i--){
      var to = events[i].at + (events[i].duration || 0)
      if (events[i].at > at || to < currentTime){
        events.splice(i, 1)
      }
    }
  }

  function getEndTime(){
    var maxTime = context.audio.currentTime
    for (var i=0;i<params.length;i++){
      var events = channels[i]
      if (events){
        var lastEvent = events[events.length-1]
        if (lastEvent){
          var endAt = lastEvent.at + (lastEvent.duration || 0)
          if (endAt > maxTime){
            maxTime = endAt
          }
        }
      }
    }
  }

  function getValueAt(time){
    var lastValue = target.defaultValue
    for (var i=0;i<params.length;i++){
      var value = getChannelValueAt(i, time)
      if (transforms[i]){
        lastValue = transforms[i](lastValue, value)
      } else {
        lastValue = value
      }
    }

    return lastValue
  }

  function getChannelValueAt(index, time){
    var events = channels[index]

    if (events){
      for (var i=0;i<events.length;i++){
        var event = events[i]
        var next = events[i+1]
        if (!next || next.at > time){
          return interpolate(event, time)
        }
      }
    }

    return lastValues[index]
  }

  function isRampingAt(time){
    for (var i=0;i<params.length;i++){
      if (channelIsRampingAt(i, time)){
        return true
      }
    }
    return false
  }

  function channelIsRampingAt(index, time){
    var events = channels[index]
    if (events){
      for (var i=0;i<events.length;i++){
        if (event.at >= time && (event.at + event.duration||0) <= time){
          return event.duration && event.mode !== 'log'
        }
      }
    }
    return false
  }
}

function interpolate(event, time){
  var to = event.at + (event.duration||0)
  if (time < event.at){
    return event.fromValue
  } else if (event.duration && time <= to){
    var range = event.value - event.fromValue
    var pos = (time - event.at) / event.duration
    if (event.mode === 'exp'){
      return event.fromValue + (range * (Math.pow(pos, 2)))
    } else if (event.mode === 'log'){
      return event.fromValue + (range * (Math.pow(pos, 1/4)))
    } else {
      return event.fromValue + (range * pos)
    }
  } else {
    return event.value
  }
}