var deepEqual = require('deep-equal')

module.exports = function update(context, container, descriptor){
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
          container.node[key].value = value
        } else {
          container.node[key] = value
        }
      }
    }
  }

  container.descriptor = descriptor
}