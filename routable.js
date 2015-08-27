var Observ = require('observ')
var ObservStruct = require('observ-struct')
var nextTick = require('next-tick')

var Property = require('observ-default')
var extend = require('xtend')

module.exports = RoutableSlot

function RoutableSlot (context, properties, input, output) {
  var audioContext = context.audio

  output = output || input

  var refreshingConnections = false
  var extraConnections = []

  var obs = ObservStruct(extend({
    id: Observ(),
    output: Observ(),
    volume: Property(1)
  }, properties))

  obs._type = 'RoutableSlot'
  obs.context = context
  obs.volume(function (value) {
    output.gain.value = value
  })

  obs.input = input

  // main output
  obs.output(queueRefreshConnections)

  var removeSlotWatcher = context.slotLookup && context.slotLookup(queueRefreshConnections)

  obs.connect = function (to) {
    extraConnections.push(to)
    refreshConnections()
  }

  obs.disconnect = function () {
    extraConnections.length = 0
    refreshConnections()
  }

  obs.destroy = function () {
    removeSlotWatcher && removeSlotWatcher()
    removeSlotWatcher = null
  }

  queueRefreshConnections()

  return obs

  // scoped

  function queueRefreshConnections () {
    if (!refreshingConnections) {
      refreshingConnections = true
      nextTick(refreshConnections)
    }
  }

  function refreshConnections () {
    refreshingConnections = false

    output.disconnect()

    extraConnections.forEach(function (target) {
      output.connect(target)
    })

    var outputNames = typeof obs.output() === 'string' ? [obs.output()] : obs.output()

    if (Array.isArray(outputNames)) {
      outputNames.forEach(function (name) {
        var destinationSlot = context.slotLookup.get(name)
        if (destinationSlot && destinationSlot.input) {
          output.connect(destinationSlot.input)
        }
      })
    }
  }
}

