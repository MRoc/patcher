import { OpType, OpTypes, getValue } from "./optype";

export { OpType, getValue };

export function emptyHistory() {
  return createHistory();
}

export function createHistory(ops, opsInverted) {
  return { ops: ops || [], opsInverted: opsInverted || [] };
}

export const defaultTransaction = -1;

export const defaultVersion = 0;

export function Patcher(type) {
  this.type = type;
}

Patcher.prototype.patch = function (state, op, newTransaction) {
  return this.patchWithOps(state, op, newTransaction)[0];
};

Patcher.prototype.patchWithOps = function (state, op, newTransaction) {
  let history = state.history || emptyHistory();
  let transaction =
    state.transaction === undefined ? defaultTransaction : state.transaction;
  if (newTransaction || transaction === defaultTransaction) {
    if (this.canMergeOp(history, transaction, op)) {
      history = this.discardFutureOps(history, transaction + 1);
      history = this.mergeLastOp(history, op);
    } else {
      transaction++;
      history = this.discardFutureOps(history, transaction);
      history = this.insertOp(state, history, op);
    }
  } else {
    history = this.insertOp(state, history, op);
  }

  return [
    combine(
      this.type.apply(state, op),
      history,
      transaction,
      nextVersion(state, op)
    ),
    op,
  ];
};

export function combine(
  state,
  history,
  transaction = defaultTransaction,
  version = defaultVersion
) {
  if (Array.isArray(state)) {
    state.history = history;
    state.transaction = transaction;
    state.version = version;
    return state;
  }

  return { ...state, history, transaction, version };
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
  const transaction = state.transaction;

  const op = state.history.opsInverted[transaction];

  if (!op) {
    throw new Error(`Nothing to undo! (transaction=${transaction})`);
  }

  return [
    combine(
      this.type.apply(state, op),
      state.history,
      transaction - 1,
      nextVersion(state, op)
    ),
    op,
  ];
};

Patcher.prototype.hasRedo = function (state) {
  return (
    state.history.ops.length > 0 &&
    state.transaction < state.history.ops.length - 1
  );
};

Patcher.prototype.redo = function (state) {
  return this.redoWithOps(state)[0];
};

Patcher.prototype.redoWithOps = function (state) {
  const transaction = state.transaction + 1;

  const op = state.history.ops[transaction];

  if (!op) {
    throw new Error(`Nothing to redo! (transaction=${transaction})`);
  }

  return [
    combine(
      this.type.apply(state, op),
      state.history,
      transaction,
      nextVersion(state, op)
    ),
    op,
  ];
};

Patcher.prototype.canMergeOp = function (history, transaction, op) {
  // TODO Can't use isArray on op!!!
  if (Array.isArray(op)) {
    if (op.length === 1) {
      op = op[0];
    } else {
      return false;
    }
  }

  // TODO Can't compare transactions
  const lastOps = history.ops.filter((op) => op.transaction === transaction);
  if (lastOps.length !== 1) {
    return false;
  }

  return this.type.composeSimilar(lastOps[0], op) !== null;
};

Patcher.prototype.mergeLastOp = function (history, op) {
  // TODO Can't use isArray on op
  if (Array.isArray(op)) {
    if (op.length !== 1) {
      throw new Error(`Merge only works on single operations!`);
    }
    op = op[0];
  }

  const lastOp = arrayLast(history.ops);
  const mergedOp = this.type.composeSimilar(lastOp, op);

  return {
    ops: [...arraySkipLast(history.ops), mergedOp],
    opsInverted: history.opsInverted,
  };
};

Patcher.prototype.discardFutureOps = function (history, transaction) {
  return {
    ops: history.ops.slice(0, transaction),
    opsInverted: history.opsInverted.slice(0, transaction),
  };
};

Patcher.prototype.insertOp = function (state, history, op) {
  // TODO If op is array, invert must also be reversed!
  const opInverted = this.type.invertWithDoc(op, state);
  return {
    ops: [...history.ops, op],
    opsInverted: [...history.opsInverted, opInverted],
  };
};

function arrayLast(array) {
  return array[array.length - 1];
}

function arraySkipLast(array) {
  return array.slice(0, array.length - 1);
}

function arrayEquals(array0, array1) {
  return (
    array0.length === array1.length &&
    array0.every((value, index) => value === array1[index])
  );
}

function arrayMax(array) {
  return Math.max(...array);
}
