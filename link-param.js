var Observ = require('observ')
var ObservStruct = require('observ-struct')
var Param = require('./param.js')
var Prop = require('./property.js')
var ParamProxy = require('./param-proxy.js')

var Transform = require('./modulators/transform.js')

module.exports = LinkParam

function LinkParam(context){

  var obs = ObservStruct({
    param: Observ(),
    minValue: Param(context, 0),
    maxValue: Param(context, 1),
    mode: Prop('linear')
  })

  obs.value = ParamProxy(context, 0)
  obs._type = 'LinkParam'
  obs.context = context

  var lastParamName = null
  var releaseParams = null

  //transform: value * (maxValue - minValue) + minValue
  var outputValue = Transform(context, [
    { param: obs.mode },
    { param: obs.value, transform: applyInterpolation },
    { param: Transform(context, [
      { param: obs.maxValue },
      { param: obs.minValue, transform: subtract }
    ]), transform: multiply },
    { param: obs.minValue, transform: add }
  ])

  obs.onSchedule = outputValue.onSchedule
  obs.getValueAt = outputValue.getValueAt

  obs.getValue = function () {
    return outputValue.getValueAt(context.audio.currentTime)
  }

  if (context.paramLookup){
    releaseParams = context.paramLookup(handleUpdate)
  }

  obs.param(handleUpdate)

  obs.destroy = function(){
    releaseParams&&releaseParams()
    releaseParams = null
    obs.value.destroy()
  }

  return obs

  // scoped

  function handleUpdate(){
    if (lastParamName !== obs.param()) {
      lastParamName = obs.param()
      setImmediate(function() {
        var param = context.paramLookup.get(obs.param())
        obs.value.setTarget(param)  
      })
    }
  }

  function applyInterpolation(mode, value) {
    if (mode === 'exp') {
      return value * value
    } else {
      return value
    }
  }
}

// transform operations
function add(a, b) { return a + b }
function subtract(a, b){ return a - b }
function multiply(a, b) { return a * b }