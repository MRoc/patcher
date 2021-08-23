"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.emptyHistory = emptyHistory;
exports.createHistory = createHistory;
exports.Patcher = Patcher;
exports.combine = combine;
Object.defineProperty(exports, "OpType", {
  enumerable: true,
  get: function get() {
    return _optype.OpType;
  }
});
Object.defineProperty(exports, "getValue", {
  enumerable: true,
  get: function get() {
    return _optype.getValue;
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

function Patcher(type) {
  this.type = type;
}

Patcher.prototype.patch = function (state, op, newTransaction) {
  return this.patchWithOps(state, op, newTransaction)[0];
};

Patcher.prototype.patchWithOps = function (state, op, newTransaction) {
  var history = state.history || emptyHistory();
  var transaction = state.transaction === undefined ? defaultTransaction : state.transaction;

  if (newTransaction || transaction === defaultTransaction) {
    if (this.canMergeOp(history, transaction, op)) {
      history = this.discardFutureOps(history, transaction + 1);
      history = this.mergeLastOp(state, history, op, false);
    } else {
      transaction++;
      history = this.discardFutureOps(history, transaction);
      history = this.insertOp(state, history, op);
    }
  } else {
    history = this.mergeLastOp(state, history, op, true);
  }

  return [combine(this.type.apply(state, op), history, transaction, nextVersion(state, op)), op];
};

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
  if (state.version === undefined) {
    state.version = defaultVersion;
  }

  return state.version + 1;
}

Patcher.prototype.hasUndo = function (state) {
  return state.history.ops.length > 0 && state.transaction > defaultTransaction;
};

Patcher.prototype.undo = function (state) {
  return this.undoWithOps(state)[0];
};

Patcher.prototype.undoWithOps = function (state) {
  var transaction = state.transaction;
  var op = state.history.opsInverted[transaction];

  if (!op) {
    throw new Error("Nothing to undo! (transaction=".concat(transaction, ")"));
  }

  return [combine(this.type.apply(state, op), state.history, transaction - 1, nextVersion(state, op)), op];
};

Patcher.prototype.hasRedo = function (state) {
  return state.history.ops.length > 0 && state.transaction < state.history.ops.length - 1;
};

Patcher.prototype.redo = function (state) {
  return this.redoWithOps(state)[0];
};

Patcher.prototype.redoWithOps = function (state) {
  var transaction = state.transaction + 1;
  var op = state.history.ops[transaction];

  if (!op) {
    throw new Error("Nothing to redo! (transaction=".concat(transaction, ")"));
  }

  return [combine(this.type.apply(state, op), state.history, transaction, nextVersion(state, op)), op];
};

Patcher.prototype.canMergeOp = function (history, transaction, op) {
  if (transaction < 0 || transaction >= history.ops.length) {
    return false;
  }

  var lastOps = history.ops[transaction];
  return this.type.composeSimilar(lastOps, op) !== null;
};

Patcher.prototype.mergeLastOp = function (state, history, op, forceCompose) {
  var opInverted = this.type.invertWithDoc(op, state);
  var composeFunc = forceCompose ? this.type.compose : this.type.composeSimilar;
  var lastOp = arrayLast(history.ops);
  var mergedOp = composeFunc(lastOp, op);
  var lastOpInverted = arrayLast(history.opsInverted);
  var mergedOpInverted = composeFunc(opInverted, lastOpInverted);
  return {
    ops: [].concat(_toConsumableArray(arraySkipLast(history.ops)), [mergedOp]),
    opsInverted: [].concat(_toConsumableArray(arraySkipLast(history.opsInverted)), [mergedOpInverted])
  };
};

Patcher.prototype.discardFutureOps = function (history, transaction) {
  return {
    ops: history.ops.slice(0, transaction),
    opsInverted: history.opsInverted.slice(0, transaction)
  };
};

Patcher.prototype.insertOp = function (state, history, op) {
  var opInverted = this.type.invertWithDoc(op, state);
  return {
    ops: [].concat(_toConsumableArray(history.ops), [op]),
    opsInverted: [].concat(_toConsumableArray(history.opsInverted), [opInverted])
  };
};

function arrayLast(array) {
  return array[array.length - 1];
}

function arraySkipLast(array) {
  return array.slice(0, array.length - 1);
}