// Overlaps with https://tools.ietf.org/html/rfc6902

import {
  OpType,
  OpTypes,
  opAdd,
  opAddRange,
  opReplace,
  opReplaceEnriched,
  opRemove,
  opRemoveEnriched,
  opRemoveRange,
  opRemoveRangeEnriched,
  opMoveRange,
  enrich,
} from "./optype";

const type = new OpType();

export {
  opAdd,
  opAddRange,
  opReplace,
  opReplaceEnriched,
  opRemove,
  opRemoveEnriched,
  opRemoveRange,
  opRemoveRangeEnriched,
  opMoveRange,
  type,
};

export function getValue(obj, path) {
  const property = path[0];
  if (path.length === 1) {
    if (Array.isArray(obj) && typeof property === "object") {
      return obj.slice(property.index, property.index + property.length);
    } else {
      return obj[property];
    }
  } else {
    return getValue(obj[property], path.slice(1));
  }
}

export function emptyHistory() {
  return [];
}

export const defaultTransaction = -1;

export const defaultVersion = 0;

export function patch(state, op, newTransaction) {
  return patchWithOps(state, op, newTransaction)[0];
}

export function patchWithOps(state, op, newTransaction) {
  let history = state.history || emptyHistory();
  let transaction =
    state.transaction === undefined ? defaultTransaction : state.transaction;
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

  return [
    combine(
      type.apply(state, op),
      history,
      transaction,
      nextVersion(state, op)
    ),
    op,
  ];
}

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

export function nextVersion(state, op) {
  if (!Array.isArray(op)) {
    op = [op];
  }
  if (state.version === undefined) {
    state.version = defaultVersion;
  }
  return state.version + op.length;
}

export function hasUndo(state) {
  return state.history.length > 0 && state.transaction > defaultTransaction;
}

export function undo(state) {
  return undoWithOps(state)[0];
}

export function undoWithOps(state) {
  const transaction = state.transaction;

  const operations = state.history
    .filter((op) => op.transaction === transaction)
    .map((op) => type.invert(op))
    .reverse();

  if (operations.length === 0) {
    throw new Error(`Nothing to undo! (transaction=${transaction})`);
  }

  return [
    combine(
      type.apply(state, operations),
      state.history,
      transaction - 1,
      nextVersion(state, operations)
    ),
    operations,
  ];
}

export function hasRedo(state) {
  return (
    state.history.length > 0 &&
    state.transaction < arrayMax(state.history.map((op) => op.transaction))
  );
}

export function redo(state) {
  return redoWithOps(state)[0];
}

export function redoWithOps(state) {
  const transaction = state.transaction + 1;

  const operations = state.history.filter(
    (op) => op.transaction === transaction
  );

  if (operations.length === 0) {
    throw new Error(`Nothing to redo! (transaction=${transaction})`);
  }

  return [
    combine(
      type.apply(state, operations),
      state.history,
      transaction,
      nextVersion(state, operations)
    ),
    operations,
  ];
}

export function canMergeOp(history, transaction, op) {
  if (Array.isArray(op)) {
    if (op.length === 1) {
      op = op[0];
    } else {
      return false;
    }
  }

  const lastOps = history.filter((op) => op.transaction === transaction);
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
}

export function mergeLastOp(history, op) {
  if (Array.isArray(op)) {
    if (op.length !== 1) {
      throw new Error(`Merge only works on single operations!`);
    }
    op = op[0];
  }

  const lastOp = arrayLast(history);
  return [...arraySkipLast(history), { ...lastOp, value: op.value }];
}

export function discardFutureOps(history, transaction) {
  return [...history.filter((op) => op.transaction < transaction)];
}

export function addOp(history, transaction, op) {
  if (Array.isArray(op)) {
    return [
      ...history,
      ...op.map((o) => {
        return { ...o, transaction };
      }),
    ];
  } else {
    return [...history, { ...op, transaction }];
  }
}

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
