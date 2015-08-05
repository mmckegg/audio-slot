var cache = new WeakMap()

module.exports = function (context, target) {
  if (context.scheduler) {
    // use global scheduler
    return context.scheduler.onSchedule(target)
  } else if (context.audio) {
    var result = cache.get(context.audio)
    if (!result) {
      result = Scheduler(context.audio)
      cache.set(context.audio, result)
    }
    return result(target)
  }
}

function Scheduler (audioContext) {
  var listeners = []
  var timer = null
  var lastTime = audioContext.currentTime

  var obs = function (listener) {
    if (!listeners.length) {
      timer = setInterval(schedule, 50)
    }
    listeners.push(listener)
    return function remove () {
      var index = listeners.indexOf(listener)
      if (~index) listeners.splice(index, 1)
      if (!listeners.length) {
        clearInterval(timer)
      }
    }
  }

  return obs

  // scoped

  function schedule () {
    var to = audioContext.currentTime + 0.1
    var data = {
      time: lastTime,
      duration: to - lastTime,
      from: lastTime,
      to: to,
      beatDuration: 1
    }
    lastTime = to
    for (var i = 0;i < listeners.length;i++) {
      listeners[i](data)
    }
  }
}
