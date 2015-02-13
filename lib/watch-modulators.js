var watch = require('observ/watch')
var deepEqual = require('deep-equal')
var union = require('array-union')
var resolveNode = require('observ-node-array/resolve')

module.exports = function(context, node, listener){
  var lastData = {}
  var modulators = {}
  var staticAttributes = {}

  var releaseResolved = null

  return watch(node, function(data){
    staticAttributes = {}
    var keys = union(Object.keys(lastData), Object.keys(data))
    keys.forEach(function(key){
      var value = data[key]
      var oldValue = lastData[key]
      var instance = modulators[key]

      if (!deepEqual(value, oldValue)){
        var oldNode = getNode(oldValue)
        var newNode = getNode(value)

        if (oldNode !== newNode){
          var ctor = resolveNode(context.nodes, newNode)
          if (instance){
            instance.disconnect && instance.disconnect()
            instance.destroy && instance.destroy()
            releaseResolved && releaseResolved()
            releaseResolved = null
            instance = null
            ;delete modulators[key]
          }

          if (ctor){
            instance = modulators[key] = ctor(context)
            if (typeof instance.resolved == 'function'){
              releaseResolved = instance.resolved(broadcast)
            }
          }
        }

        if (instance){
          instance.set(value)
        }
      }

      if (!instance && key in data){
        staticAttributes[key] = value
      }
    })

    lastData = data
    broadcast()
  })

  // scoped

  function broadcast(){
    listener(staticAttributes, modulators)
  }

  function getNode(value){
    return value && value[context.nodeKey||'node'] || null
  }
}