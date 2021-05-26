"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.opAdd = opAdd;
exports.opAddRange = opAddRange;
exports.opReplace = opReplace;
exports.opRemove = opRemove;
exports.opRemoveRange = opRemoveRange;
exports.opMoveRange = opMoveRange;
exports.enrich = enrich;
exports.opReplaceEnriched = opReplaceEnriched;
exports.opRemoveEnriched = opRemoveEnriched;
exports.opRemoveRangeEnriched = opRemoveRangeEnriched;
exports.inverse = inverse;
exports.emptyHistory = emptyHistory;
exports.patch = patch;
exports.patchWithOps = patchWithOps;
exports.combine = combine;
exports.hasUndo = hasUndo;
exports.undo = undo;
exports.undoWithOps = undoWithOps;
exports.hasRedo = hasRedo;
exports.redo = redo;
exports.redoWithOps = redoWithOps;
exports.canMergeOp = canMergeOp;
exports.mergeLastOp = mergeLastOp;
exports.discardFutureOps = discardFutureOps;
exports.addOp = addOp;
exports.applyOp = applyOp;
exports.defaultTransaction = void 0;

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _iterableToArrayLimit(arr, i) { var _i = arr && (typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"]); if (_i == null) return; var _arr = []; var _n = true; var _d = false; var _s, _e; try { for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// Overlaps with https://tools.ietf.org/html/rfc6902
var OpTypes = {
  ADD: "add",
  ADD_RANGE: "add_range",
  REPLACE: "replace",
  REMOVE: "remove",
  REMOVE_RANGE: "remove_range",
  MOVE_RANGE: "move_range"
};

function opAdd(path, value, transaction) {
  return {
    op: OpTypes.ADD,
    transaction: transaction,
    path: path,
    value: value
  };
}

function opAddRange(path, value, transaction) {
  return {
    op: OpTypes.ADD_RANGE,
    transaction: transaction,
    path: path,
    value: value
  };
}

function opReplace(path, value, transaction) {
  return {
    op: OpTypes.REPLACE,
    transaction: transaction,
    path: path,
    value: value
  };
}

function opRemove(path, transaction) {
  return {
    op: OpTypes.REMOVE,
    transaction: transaction,
    path: path
  };
}

function opRemoveRange(path, transaction) {
  return {
    op: OpTypes.REMOVE_RANGE,
    transaction: transaction,
    path: path
  };
}

function opMoveRange(path, transaction) {
  return {
    op: OpTypes.MOVE_RANGE,
    transaction: transaction,
    path: path
  };
}

function enrich(obj, op) {
  if (Array.isArray(op)) {
    return op.map(function (o) {
      return enrich(obj, o);
    });
  }

  if (op.op === OpTypes.REPLACE || op.op === OpTypes.REMOVE || op.op === OpTypes.REMOVE_RANGE) {
    return _objectSpread(_objectSpread({}, op), {}, {
      previous: getValue(obj, op.path)
    });
  }

  return op;
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

function opReplaceEnriched(path, previous, value, transaction) {
  return _objectSpread(_objectSpread({}, opReplace(path, value, transaction)), {}, {
    previous: previous
  });
}

function opRemoveEnriched(path, previous, transaction) {
  return _objectSpread(_objectSpread({}, opRemove(path, transaction)), {}, {
    previous: previous
  });
}

function opRemoveRangeEnriched(path, previous, transaction) {
  return _objectSpread(_objectSpread({}, opRemoveRange(path, transaction)), {}, {
    previous: previous
  });
}

function inverse(op) {
  switch (op.op) {
    case OpTypes.ADD:
      return opRemove(op.path);

    case OpTypes.ADD_RANGE:
      return opRemoveRange([].concat(_toConsumableArray(arraySkipLast(op.path)), [{
        index: arrayLast(op.path),
        length: op.value.length
      }]));

    case OpTypes.REPLACE:
      return opReplaceEnriched(op.path, op.value, op.previous);

    case OpTypes.REMOVE:
      return opAdd(op.path, op.previous);

    case OpTypes.REMOVE_RANGE:
      return opAddRange([].concat(_toConsumableArray(arraySkipLast(op.path)), [arrayLast(op.path).index]), op.previous);

    case OpTypes.MOVE_RANGE:
      {
        var _arrayLast = arrayLast(op.path),
            _arrayLast2 = _slicedToArray(_arrayLast, 2),
            r0 = _arrayLast2[0],
            p0 = _arrayLast2[1];

        var r1, p1;

        if (r0.index < p0) {
          r1 = {
            index: p0 - r0.length,
            length: r0.length
          };
          p1 = r0.index;
        } else {
          r1 = {
            index: p0,
            length: r0.length
          };
          p1 = r0.index + r0.length;
        }

        return opMoveRange([].concat(_toConsumableArray(op.path.slice(0, -1)), [[r1, p1]]));
      }

    default:
      throw new Error("Unknown operation op '".concat(op.op, "'"));
  }
}

function emptyHistory() {
  return [];
}

var defaultTransaction = -1;
exports.defaultTransaction = defaultTransaction;

function patch(state, op, newTransaction) {
  return patchWithOps(state, op, newTransaction)[0];
}

function patchWithOps(state, op, newTransaction) {
  var history = state.history || emptyHistory();
  var transaction = state.transaction === undefined ? defaultTransaction : state.transaction;

  if (newTransaction || transaction === defaultTransaction) {
    if (canMergeOp(history, transaction, op)) {
      history = discardFutureOps(history, transaction + 1);
      history = mergeLastOp(history, op);
    } else {
      transaction++;
      history = discardFutureOps(history, transaction);
      history = addOp(history, transaction, enrich(state, op));
    }
  } else {
    history = addOp(history, transaction, enrich(state, op));
  }

  return [combine(applyOp(state, op), history, transaction), op];
}

function combine(state, history, transaction) {
  if (Array.isArray(state)) {
    state.history = history;
    state.transaction = transaction;
    return state;
  }

  return _objectSpread(_objectSpread({}, state), {}, {
    history: history,
    transaction: transaction
  });
}

function hasUndo(state) {
  return state.history.length > 0 && state.transaction > defaultTransaction;
}

function undo(state) {
  return undoWithOps(state)[0];
}

function undoWithOps(state) {
  var transaction = state.transaction;
  var operations = state.history.filter(function (op) {
    return op.transaction === transaction;
  }).map(function (op) {
    return inverse(op);
  }).reverse();

  if (operations.length === 0) {
    throw new Error("Nothing to undo! (transaction=".concat(transaction, ")"));
  }

  return [combine(applyOp(state, operations), state.history, transaction - 1), operations];
}

function hasRedo(state) {
  return state.history.length > 0 && state.transaction < arrayMax(state.history.map(function (op) {
    return op.transaction;
  }));
}

function redo(state) {
  return redoWithOps(state)[0];
}

function redoWithOps(state) {
  var transaction = state.transaction + 1;
  var operations = state.history.filter(function (op) {
    return op.transaction === transaction;
  });

  if (operations.length === 0) {
    throw new Error("Nothing to redo! (transaction=".concat(transaction, ")"));
  }

  return [combine(applyOp(state, operations), state.history, transaction), operations];
}

function canMergeOp(history, transaction, op) {
  if (Array.isArray(op)) {
    if (op.length === 1) {
      op = op[0];
    } else {
      return false;
    }
  }

  var lastOps = history.filter(function (op) {
    return op.transaction === transaction;
  });

  if (lastOps.length !== 1) {
    return false;
  }

  var lastOp = lastOps[0];

  if (lastOp.op !== OpTypes.REPLACE) {
    return false;
  }

  if (!arrayEquals(lastOp.path, op.path)) {
    return false;
  }

  return true;
}

function mergeLastOp(history, op) {
  if (Array.isArray(op)) {
    throw new Error("Merge only works on single operations!");
  }

  var lastOp = arrayLast(history);
  return [].concat(_toConsumableArray(arraySkipLast(history)), [_objectSpread(_objectSpread({}, lastOp), {}, {
    value: op.value
  })]);
}

function discardFutureOps(history, transaction) {
  return _toConsumableArray(history.filter(function (op) {
    return op.transaction < transaction;
  }));
}

function addOp(history, transaction, op) {
  if (Array.isArray(op)) {
    return [].concat(_toConsumableArray(history), _toConsumableArray(op.map(function (o) {
      return _objectSpread(_objectSpread({}, o), {}, {
        transaction: transaction
      });
    })));
  } else {
    return [].concat(_toConsumableArray(history), [_objectSpread(_objectSpread({}, op), {}, {
      transaction: transaction
    })]);
  }
}

function applyOp(obj, op) {
  if (!op) {
    return obj;
  }

  if (Array.isArray(op)) {
    return op.reduce(function (prev, o) {
      return applyOp(prev, o);
    }, obj);
  }

  if (Array.isArray(obj)) {
    return applyOpArray(obj, op);
  } else {
    return applyOpObject(obj, op);
  }
}

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

      case OpTypes.MOVE_RANGE:
        return arrayMoveRange(obj, index);

      default:
        throw new Error("Unknown operation op '".concat(op.op, "'"));
    }
  } else {
    return arrayReplace(obj, index, applyOp(obj[index], createOpDescend(op)));
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
          result[property] = applyOp(obj[property], createOpDescend(op));
        }
      } else {
        result[property] = obj[property];
      }
    }
  }

  if (op.op === OpTypes.ADD && op.path.length === 1) {
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

function arrayMoveRange(array, ranges) {
  var _ranges = _slicedToArray(ranges, 2),
      range = _ranges[0],
      pos = _ranges[1];

  if (pos >= range.index && pos < range.index.length) {
    throw new Error("Can't move range inside itself!");
  }

  if (range.index < pos) {
    return [].concat(_toConsumableArray(array.slice(0, range.index)), _toConsumableArray(array.slice(range.index + range.length, pos)), _toConsumableArray(array.slice(range.index, range.index + range.length)), _toConsumableArray(array.slice(pos, array.length)));
  } else {
    return [].concat(_toConsumableArray(array.slice(0, pos)), _toConsumableArray(array.slice(range.index, range.index + range.length)), _toConsumableArray(array.slice(pos, range.index)), _toConsumableArray(array.slice(range.index + range.length, array.length)));
  }
}

function arrayLast(array) {
  return array[array.length - 1];
}

function arraySkipLast(array) {
  return array.slice(0, array.length - 1);
}

function arrayEquals(array0, array1) {
  return array0.length === array1.length && array0.every(function (value, index) {
    return value === array1[index];
  });
}

function arrayMax(array) {
  return Math.max.apply(Math, _toConsumableArray(array));
}

function createOpDescend(operation) {
  return _objectSpread(_objectSpread({}, operation), {}, {
    path: operation.path.slice(1)
  });
}