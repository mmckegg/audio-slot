var Observ = require('observ')

module.exports = function TempoFromDuration (duration, offset, buffer, sync) {
  var obs = Observ()
  var updating = false
  var set = obs.set
  var lastSetValue = null

  obs.set = function (value) {
    lastSetValue = value
    if (buffer()) {
      var originalDuration = getOffsetDuration(buffer().duration, offset())
      duration.set(value / 60 * originalDuration)
    }
  }

  obs.startBeat = Observ()
  var setStartBeat = obs.startBeat.set
  obs.startBeat.set = function (value) {
    if (buffer()) {
      var beats = (obs() / 60) * buffer().duration
      offset.set([value / beats, offset()[1]])
    }
  }

  duration(refresh)
  offset(refreshOther)
  buffer(refreshOther)

  return obs

  // scoped

  function refreshOther () {
    if (sync() && lastSetValue && buffer()) {
      setImmediate(function () {
        var originalDuration = getOffsetDuration(buffer().duration, offset())
        duration.set(lastSetValue / 60 * originalDuration)
      })
    } else {
      refresh()
    }
  }

  function refresh () {
    if (buffer() && Array.isArray(offset())) {
      var originalDuration = getOffsetDuration(buffer().duration, offset())
      var value = duration() / originalDuration * 60
      var beats = (value / 60) * buffer().duration
      if (value !== obs()) {
        set(value)
        setStartBeat(beats * offset()[0])
      }
    }
  }
}

function getOffsetDuration(duration, offset) {
  return (offset[1] * duration) - (offset[0] * duration)
}