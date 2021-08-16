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
      history = this.insertOp(state, history, transaction, op);
    }
  } else {
    history = this.insertOp(state, history, transaction, op);
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
  if (!Array.isArray(op)) {
    op = [op];
  }
  if (state.version === undefined) {
    state.version = defaultVersion;
  }
  return state.version + op.length;
}

Patcher.prototype.hasUndo = function (state) {
  return state.history.ops.length > 0 && state.transaction > defaultTransaction;
};

Patcher.prototype.undo = function (state) {
  return this.undoWithOps(state)[0];
};

Patcher.prototype.undoWithOps = function (state) {
  const transaction = state.transaction;

  const operations = state.history.opsInverted
    .filter((op) => op.transaction === transaction)
    .reverse();

  if (operations.length === 0) {
    throw new Error(`Nothing to undo! (transaction=${transaction})`);
  }

  return [
    combine(
      this.type.apply(state, operations),
      state.history,
      transaction - 1,
      nextVersion(state, operations)
    ),
    operations,
  ];
};

Patcher.prototype.hasRedo = function (state) {
  return (
    state.history.ops.length > 0 &&
    state.transaction < arrayMax(state.history.ops.map((op) => op.transaction))
  );
};

Patcher.prototype.redo = function (state) {
  return this.redoWithOps(state)[0];
};

Patcher.prototype.redoWithOps = function (state) {
  const transaction = state.transaction + 1;

  const operations = state.history.ops.filter(
    (op) => op.transaction === transaction
  );

  if (operations.length === 0) {
    throw new Error(`Nothing to redo! (transaction=${transaction})`);
  }

  return [
    combine(
      this.type.apply(state, operations),
      state.history,
      transaction,
      nextVersion(state, operations)
    ),
    operations,
  ];
};

Patcher.prototype.canMergeOp = function (history, transaction, op) {
  if (Array.isArray(op)) {
    if (op.length === 1) {
      op = op[0];
    } else {
      return false;
    }
  }

  const lastOps = history.ops.filter((op) => op.transaction === transaction);
  if (lastOps.length !== 1) {
    return false;
  }

  const lastOp = lastOps[0];
  if (lastOp.op !== OpTypes.REPLACE) {
    return false;
  }

  if (!arrayEquals(lastOp.path, op.path)) {
    return false;
  }

  return true;
};

Patcher.prototype.mergeLastOp = function (history, op) {
  if (Array.isArray(op)) {
    if (op.length !== 1) {
      throw new Error(`Merge only works on single operations!`);
    }
    op = op[0];
  }

  const lastOp = arrayLast(history.ops);

  return {
    ops: [...arraySkipLast(history.ops), { ...lastOp, value: op.value }],
    opsInverted: history.opsInverted,
  };
};

Patcher.prototype.discardFutureOps = function (history, transaction) {
  return {
    ops: history.ops.filter((op) => op.transaction < transaction),
    opsInverted: history.opsInverted.filter(
      (op) => op.transaction < transaction
    ),
  };
};

Patcher.prototype.insertOp = function (state, history, transaction, op) {
  if (!Array.isArray(op)) {
    op = [op];
  }

  const ops = op.map((o) => {
    return { ...o, transaction };
  });

  const opsInverted = op.map((o) => {
    return { ...this.type.invertWithDoc(o, state), transaction };
  });

  return {
    ops: [...history.ops, ...ops],
    opsInverted: [...history.opsInverted, ...opsInverted],
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
