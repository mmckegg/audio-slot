var watch = require('observ/watch')
var Event = require('geval')

module.exports = ParamProxy

function ParamProxy(context, defaultValue){
  var target = null
  var release = null

  var obs = proxy()
  obs.getValueAt = proxy('getValueAt', defaultValue)
  obs.getValue = proxy('getValue')
  obs.getReleaseDuration = proxy('getReleaseDuration')
  obs.context = context

  var broadcast = null
  obs.onSchedule = Event(function(b){
    broadcast = b
  })

  obs.setTarget = function (value) {
    if (value !== target) {
      release&&release()
      release = null
      target = value

      if (value) {

        if (value.onSchedule) {
          release = value.onSchedule(broadcast)

          if (value.getValue) {
            broadcast({
              at: context.audio.currentTime, 
              value: value.getValue() 
            })
          }

        } else if (typeof value === 'function') {
          release = watch(value, function(data) {
            broadcast({
              value: data,
              at: context.audio.currentTime
            })
          })
        }
      }
    }
  }

  obs.getTarget = function () {
    return target
  }

  obs.destroy = function () {
    release&&release()
    target = null
  }

  return obs

  //

  function proxy (methodName, defaultValue) {
    if (methodName) {
      return function (_) {
        if (target && target[methodName]) {
          return target[methodName].apply(target, arguments)
        } else {
          return defaultValue
        }
      }
    } else {
      return function (_) {
        if (target && typeof target === 'function') {
          return target.apply(target, arguments)
        } else {
          return defaultValue
        }
      }
    }
  }
}