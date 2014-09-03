var deepEqual = require('deep-equal')

module.exports = update

var blackList = ['start', 'stop', 'context', 'constructor', 'output']

function update(context, container, descriptor){
  var changes = {newModulators: []}

  var protoProps = Object.getOwnPropertyNames(Object.getPrototypeOf(container.node))
  var properties = Object.getOwnPropertyNames(container.node).concat(protoProps)

  if (descriptor instanceof Object){
    var node = container.node

    for (var i=0;i<properties.length;i++){
      var key = properties[i]
      var value = descriptor[key]

      if (isPropertyTarget(key) && !deepEqual(value, container.descriptor[key])){

        var object = null
        if (value instanceof Object && !Array.isArray(value)){
          object = value
          value = getValue(object)
        }

        if (isAudioParam(node[key])){
          var param = node[key]

          // fallback to default value if no value supplied
          if (value == null){
            value = param.defaultValue
          }

          param.value = value

          // check for changes to the modulator or remove it if no longer needed
          var oldModulator = param.modulator && param.modulator.node
          var modChanges = updateModulator(context, param, object)
          if (modChanges){ // sub modulators
            for (var z=0;z<modChanges.newModulators.length;z++){
              container.modulators.push(modChanges.newModulators[z])
              changes.newModulators.push(modChanges.newModulators[z])
            }
          }

          // update the modulator list if the modulator has changed or been removed
          var newModulator = param.modulator && param.modulator.node
          if (oldModulator != newModulator){
            var oldIndex = container.modulators.indexOf(oldModulator)
            if (~oldIndex){
              container.modulators.splice(oldIndex, 1)
            }
            if (newModulator){
              changes.newModulators.push(newModulator)
              container.modulators.push(newModulator)
            }
          }


        } else if (value != null){
          node[key] = value
        }

      }
    }
  }

  container.descriptor = descriptor
  return changes
}

function updateModulator(context, param, descriptor){
  var modulators = context.modulators || {}

  if (!descriptor && param.modulator){
    param.modulator.node.destroy&&param.modulator.node.destroy()
    param.modulator = null
  } else if (descriptor && (!param.modulator || !deepEqual(param.modulator.descriptor, descriptor))){

    if (!param.modulator){
      param.modulator = { node: null, modulators: [], descriptor: {} }
    }

    if (param.modulator.descriptor.node != descriptor.node){

      if (param.modulator.node){
        if (param.modulator.node.destroy){
          param.modulator.node.destroy()
        } else {
          param.modulator.node.disconnect()
        }
      }

      if (typeof modulators[descriptor.node] === 'function'){
        param.modulator.node = modulators[descriptor.node](context)
        param.modulator.node.connect(param)
      } else {
        param.modulator = null
      }

    }

    if (param.modulator){
      return update(context, param.modulator, descriptor)
    }
  }
}

function isPropertyTarget(key){
  return !~blackList.indexOf(key) && key.charAt(0) !== '_'
}

function isAudioParam(node){
  return (node instanceof Object && node.setValueAtTime)
}

function getValue(object){
  if (object instanceof Object && !Array.isArray(object)){
    return getValue(object.value)
  } else {
    return object
  }
}