var Observ = require('observ')
var ObservStruct = require('observ-struct')
var Param = require('../param.js')
var Event = require('geval')

var Transform = require('./transform.js')

module.exports = ParamModulator

function ParamModulator(context){

  var obs = ObservStruct({
    param: Observ(),
    value: Param(context, 1)
  })

  obs.context = context

  var currentParam = null

  var releaseSchedule = null
  var releaseParams = null

  var handleSchedule = null

  var eventSource = {
    onSchedule: Event(function(broadcast){
      handleSchedule = broadcast
    }),
    getValue: function(){
      if (currentParam && currentParam.getValueAt){
        return currentParam.getValueAt(context.audio.currentTime)
      } else {
        return 0
      }
    }
  }

  var transformedValue = Transform(context, [
    { param: obs.value },
    { param: eventSource, transform: operation }
  ])

  obs.onSchedule = transformedValue.onSchedule
  obs.getValueAt = transformedValue.getValueAt

  if (context.paramLookup){
    releaseParams = context.paramLookup(handleUpdate)
  }

  obs.destroy = function(){
    releaseParams&&releaseParams()
    releaseSchedule&&releaseSchedule()
    releaseSchedule = releaseParams = null
  }

  return obs

  // scale

  function handleUpdate(){
    var param = context.paramLookup.get(obs.param())
    if (currentParam !== param){
      releaseSchedule&&releaseSchedule()
      releaseSchedule = null
    }

    if (param){
      releaseSchedule = param.onSchedule(handleSchedule)
    }

    currentParam = param
  }

  function operation(base, value){
    return base + value
  }

}