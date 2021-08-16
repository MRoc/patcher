"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.opAdd = opAdd;
exports.opAddRange = opAddRange;
exports.opReplace = opReplace;
exports.opRemove = opRemove;
exports.opRemoveRange = opRemoveRange;
exports.OpType = OpType;
exports.getValue = getValue;
exports.OpTypes = void 0;

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// Overlaps with https://tools.ietf.org/html/rfc6902
var OpTypes = {
  ADD: "add",
  ADD_RANGE: "add_range",
  REPLACE: "replace",
  REMOVE: "remove",
  REMOVE_RANGE: "remove_range"
};
exports.OpTypes = OpTypes;

function opAdd(path, value, transaction) {
  return _objectSpread(_objectSpread({}, createOp(OpTypes.ADD, path, transaction)), {}, {
    value: value
  });
}

function opAddRange(path, value, transaction) {
  return _objectSpread(_objectSpread({}, createOp(OpTypes.ADD_RANGE, path, transaction)), {}, {
    value: value
  });
}

function opReplace(path, value, transaction) {
  return _objectSpread(_objectSpread({}, createOp(OpTypes.REPLACE, path, transaction)), {}, {
    value: value
  });
}

function opRemove(path, transaction) {
  return createOp(OpTypes.REMOVE, path, transaction);
}

function opRemoveRange(path, transaction) {
  return createOp(OpTypes.REMOVE_RANGE, path, transaction);
}

function createOp(op, path, transaction) {
  var result = {
    op: op,
    path: path
  };

  if (transaction !== undefined) {
    result.transaction = transaction;
  }

  return result;
} // https://github.com/Teamwork/ot-docs


function OpType() {}

OpType.prototype.apply = function (doc, op) {
  if (!op) {
    return doc;
  }

  if (Array.isArray(op)) {
    return op.reduce(function (prev, o) {
      return OpType.prototype.apply(prev, o);
    }, doc);
  }

  if (Array.isArray(doc)) {
    return applyOpArray(doc, op);
  } else {
    return applyOpObject(doc, op);
  }
};

OpType.prototype.invertWithDoc = function (op, doc) {
  switch (op.op) {
    case OpTypes.ADD:
      return opRemove(op.path, op.transaction);

    case OpTypes.ADD_RANGE:
      return opRemoveRange([].concat(_toConsumableArray(arraySkipLast(op.path)), [{
        index: arrayLast(op.path),
        length: op.value.length
      }]));

    case OpTypes.REPLACE:
      return opReplace(op.path, getValue(doc, op.path), op.transaction);

    case OpTypes.REMOVE:
      return opAdd(op.path, getValue(doc, op.path), op.transaction);

    case OpTypes.REMOVE_RANGE:
      return opAddRange([].concat(_toConsumableArray(arraySkipLast(op.path)), [arrayLast(op.path).index]), getValue(doc, op.path), op.transaction);

    default:
      throw new Error("Unknown operation op '".concat(op.op, "'"));
  }
};

OpType.prototype.composeSimilar = function (op1, op2) {
  // TODO Should do what canMerge does
  return null;
};

function applyOpArray(obj, op) {
  var index = op.path[0];

  if (op.path.length === 1) {
    switch (op.op) {
      case OpTypes.REPLACE:
        return arrayReplace(obj, index, op.value);

      case OpTypes.ADD:
        return arrayAdd(obj, index, op.value);

      case OpTypes.ADD_RANGE:
        return arrayAddRange(obj, index, op.value);

      case OpTypes.REMOVE:
        return arrayRemove(obj, index);

      case OpTypes.REMOVE_RANGE:
        return arrayRemoveRange(obj, index);

      default:
        throw new Error("Unknown operation op '".concat(op.op, "'"));
    }
  } else {
    return arrayReplace(obj, index, OpType.prototype.apply(obj[index], createOpDescend(op)));
  }
}

function applyOpObject(obj, op) {
  var result = {};

  for (var property in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, property)) {
      if (op.path && op.path[0] === property) {
        if (op.path.length === 1) {
          if (op.op === OpTypes.REPLACE || op.op === OpTypes.ADD) {
            result[property] = op.value;
          }
        } else {
          result[property] = OpType.prototype.apply(obj[property], createOpDescend(op));
        }
      } else {
        result[property] = obj[property];
      }
    }
  }

  if ((op.op === OpTypes.REPLACE || op.op === OpTypes.ADD) && op.path.length === 1) {
    result[op.path[0]] = op.value;
  }

  return result;
}

function arrayReplace(array, index, value) {
  return [].concat(_toConsumableArray(array.slice(0, index)), [value], _toConsumableArray(array.slice(index + 1)));
}

function arrayAddRange(array, index, values) {
  return [].concat(_toConsumableArray(array.slice(0, index)), _toConsumableArray(values), _toConsumableArray(array.slice(index)));
}

function arrayAdd(array, index, value) {
  return [].concat(_toConsumableArray(array.slice(0, index)), [value], _toConsumableArray(array.slice(index)));
}

function arrayRemoveRange(array, index) {
  if (_typeof(index) !== "object") {
    throw new Error("To remove a range, index must be an object!");
  }

  return [].concat(_toConsumableArray(array.slice(0, index.index)), _toConsumableArray(array.slice(index.index + index.length)));
}

function arrayRemove(array, index) {
  if (typeof index !== "number") {
    throw new Error("To remove, index must be a number!");
  }

  return [].concat(_toConsumableArray(array.slice(0, index)), _toConsumableArray(array.slice(index + 1)));
}

function createOpDescend(operation) {
  return _objectSpread(_objectSpread({}, operation), {}, {
    path: operation.path.slice(1)
  });
}

function getValue(obj, path) {
  var property = path[0];

  if (path.length === 1) {
    if (Array.isArray(obj) && _typeof(property) === "object") {
      return obj.slice(property.index, property.index + property.length);
    } else {
      return obj[property];
    }
  } else {
    return getValue(obj[property], path.slice(1));
  }
}

function arrayLast(array) {
  return array[array.length - 1];
}

function arraySkipLast(array) {
  return array.slice(0, array.length - 1);
}