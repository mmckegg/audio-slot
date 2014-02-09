var deepEqual = require('deep-equal')

module.exports = update

function update(context, container, descriptor){
  var changes = {newModulators: []}
  var properties = Object.getOwnPropertyNames(container.node)
  var keys = Object.keys(descriptor)
  for (var i=0;i<keys.length;i++){

    var key = keys[i]
    var value = descriptor[key]
    var oldValue = container.descriptor[key]

    if (!deepEqual(value, container.descriptor[key])){
      var object = null

      if (value instanceof Object && !Array.isArray(value)){
        object = value
        value = object.value
      }

      if (~properties.indexOf(key)){
        var prop = container.node[key]
        if (prop && Object.prototype.hasOwnProperty.call(prop, 'value')){

          // set root value
          prop.value = value

          // add/update modulator
          var oldModulator = prop.modulator && prop.modulator.node
          updateModulator(context, prop, object)
          var newModulator = prop.modulator && prop.modulator.node
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

        } else {
          container.node[key] = value
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
    param.modulator.node.destroy()
    param.modulator = null
  } else if (descriptor && (!param.modulator || !deepEqual(param.modulator.descriptor, descriptor))){

    if (!param.modulator){
      param.modulator = { node: null, modulators: [], descriptor: {} }
    }

    if (param.modulator.descriptor.node != descriptor.node){

      if (param.modulator.node){
        param.modulator.node.destroy()
      }

      if (typeof modulators[descriptor.node] === 'function'){
        param.modulator.node = modulators[descriptor.node](context)
        param.modulator.node.connect(param)
      } else {
        param.modulator = null
      }

    }

    if (param.modulator){
      update(context, param.modulator, descriptor)
    }
  }
}