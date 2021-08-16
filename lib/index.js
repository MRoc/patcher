"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getValue = getValue;
exports.emptyHistory = emptyHistory;
exports.createHistory = createHistory;
exports.patch = patch;
exports.patchWithOps = patchWithOps;
exports.combine = combine;
exports.nextVersion = nextVersion;
exports.hasUndo = hasUndo;
exports.undo = undo;
exports.undoWithOps = undoWithOps;
exports.hasRedo = hasRedo;
exports.redo = redo;
exports.redoWithOps = redoWithOps;
exports.canMergeOp = canMergeOp;
exports.mergeLastOp = mergeLastOp;
exports.discardFutureOps = discardFutureOps;
exports.insertOp = insertOp;
Object.defineProperty(exports, "OpType", {
  enumerable: true,
  get: function get() {
    return _optype.OpType;
  }
});
exports.defaultVersion = exports.defaultTransaction = void 0;

var _optype = require("./optype");

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var type = new _optype.OpType();

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

function emptyHistory() {
  return createHistory();
}

function createHistory(ops, opsInverted) {
  return {
    ops: ops || [],
    opsInverted: opsInverted || []
  };
}

var defaultTransaction = -1;
exports.defaultTransaction = defaultTransaction;
var defaultVersion = 0;
exports.defaultVersion = defaultVersion;

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
      history = insertOp(state, history, transaction, op);
    }
  } else {
    history = insertOp(state, history, transaction, op);
  }

  return [combine(type.apply(state, op), history, transaction, nextVersion(state, op)), op];
}

function combine(state, history) {
  var transaction = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : defaultTransaction;
  var version = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : defaultVersion;

  if (Array.isArray(state)) {
    state.history = history;
    state.transaction = transaction;
    state.version = version;
    return state;
  }

  return _objectSpread(_objectSpread({}, state), {}, {
    history: history,
    transaction: transaction,
    version: version
  });
}

function nextVersion(state, op) {
  if (!Array.isArray(op)) {
    op = [op];
  }

  if (state.version === undefined) {
    state.version = defaultVersion;
  }

  return state.version + op.length;
}

function hasUndo(state) {
  return state.history.ops.length > 0 && state.transaction > defaultTransaction;
}

function undo(state) {
  return undoWithOps(state)[0];
}

function undoWithOps(state) {
  var transaction = state.transaction;
  var operations = state.history.opsInverted.filter(function (op) {
    return op.transaction === transaction;
  }).reverse();

  if (operations.length === 0) {
    throw new Error("Nothing to undo! (transaction=".concat(transaction, ")"));
  }

  return [combine(type.apply(state, operations), state.history, transaction - 1, nextVersion(state, operations)), operations];
}

function hasRedo(state) {
  return state.history.ops.length > 0 && state.transaction < arrayMax(state.history.ops.map(function (op) {
    return op.transaction;
  }));
}

function redo(state) {
  return redoWithOps(state)[0];
}

function redoWithOps(state) {
  var transaction = state.transaction + 1;
  var operations = state.history.ops.filter(function (op) {
    return op.transaction === transaction;
  });

  if (operations.length === 0) {
    throw new Error("Nothing to redo! (transaction=".concat(transaction, ")"));
  }

  return [combine(type.apply(state, operations), state.history, transaction, nextVersion(state, operations)), operations];
}

function canMergeOp(history, transaction, op) {
  if (Array.isArray(op)) {
    if (op.length === 1) {
      op = op[0];
    } else {
      return false;
    }
  }

  var lastOps = history.ops.filter(function (op) {
    return op.transaction === transaction;
  });

  if (lastOps.length !== 1) {
    return false;
  }

  var lastOp = lastOps[0];

  if (lastOp.op !== _optype.OpTypes.REPLACE) {
    return false;
  }

  if (!arrayEquals(lastOp.path, op.path)) {
    return false;
  }

  return true;
}

function mergeLastOp(history, op) {
  if (Array.isArray(op)) {
    if (op.length !== 1) {
      throw new Error("Merge only works on single operations!");
    }

    op = op[0];
  }

  var lastOp = arrayLast(history.ops);
  return {
    ops: [].concat(_toConsumableArray(arraySkipLast(history.ops)), [_objectSpread(_objectSpread({}, lastOp), {}, {
      value: op.value
    })]),
    opsInverted: history.opsInverted
  };
}

function discardFutureOps(history, transaction) {
  return {
    ops: history.ops.filter(function (op) {
      return op.transaction < transaction;
    }),
    opsInverted: history.opsInverted.filter(function (op) {
      return op.transaction < transaction;
    })
  };
}

function insertOp(state, history, transaction, op) {
  if (!Array.isArray(op)) {
    op = [op];
  }

  var ops = op.map(function (o) {
    return _objectSpread(_objectSpread({}, o), {}, {
      transaction: transaction
    });
  });
  var opsInverted = op.map(function (o) {
    return _objectSpread(_objectSpread({}, type.invertWithDoc(o, state)), {}, {
      transaction: transaction
    });
  });
  return {
    ops: [].concat(_toConsumableArray(history.ops), _toConsumableArray(ops)),
    opsInverted: [].concat(_toConsumableArray(history.opsInverted), _toConsumableArray(opsInverted))
  };
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