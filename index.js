// Overlaps with https://tools.ietf.org/html/rfc6902
const OpTypes = {
  ADD: "add",
  ADD_RANGE: "add_range",
  REPLACE: "replace",
  REMOVE: "remove",
  REMOVE_RANGE: "remove_range",
  SWAP_RANGES: "swap_ranges",
  MOVE_RANGE: "move_range",
};

export function opAdd(path, value, transaction) {
  return { op: OpTypes.ADD, transaction, path, value };
}

export function opAddRange(path, value, transaction) {
  return { op: OpTypes.ADD_RANGE, transaction, path, value };
}

export function opReplace(path, value, transaction) {
  return { op: OpTypes.REPLACE, transaction, path, value };
}

export function opRemove(path, transaction) {
  return { op: OpTypes.REMOVE, transaction, path };
}

export function opRemoveRange(path, transaction) {
  return { op: OpTypes.REMOVE_RANGE, transaction, path };
}

export function opSwapRanges(path, transaction) {
  return { op: OpTypes.SWAP_RANGES, transaction, path };
}

export function opMoveRange(path, transaction) {
  return { op: OpTypes.MOVE_RANGE, transaction, path };
}

export function enrich(obj, op) {
  if (Array.isArray(op)) {
    return op.map((o) => enrich(obj, o));
  }

  if (
    op.op === OpTypes.REPLACE ||
    op.op === OpTypes.REMOVE ||
    op.op === OpTypes.REMOVE_RANGE
  ) {
    return { ...op, previous: getValue(obj, op.path) };
  }

  return op;
}

function getValue(obj, path) {
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

export function opReplaceEnriched(path, previous, value, transaction) {
  return { ...opReplace(path, value, transaction), previous };
}

export function opRemoveEnriched(path, previous, transaction) {
  return { ...opRemove(path, transaction), previous };
}

export function opRemoveRangeEnriched(path, previous, transaction) {
  return { ...opRemoveRange(path, transaction), previous };
}

export function inverse(op) {
  switch (op.op) {
    case OpTypes.ADD:
      return opRemove(op.path);
    case OpTypes.ADD_RANGE:
      return opRemoveRange([
        ...arraySkipLast(op.path),
        { index: arrayLast(op.path), length: op.value.length },
      ]);
    case OpTypes.REPLACE:
      return opReplaceEnriched(op.path, op.value, op.previous);
    case OpTypes.REMOVE:
      return opAdd(op.path, op.previous);
    case OpTypes.REMOVE_RANGE:
      return opAddRange(
        [...arraySkipLast(op.path), arrayLast(op.path).index],
        op.previous
      );
    case OpTypes.SWAP_RANGES: {
      const [r00, r10] = arraySort(
        arrayLast(op.path),
        (a, b) => a.index - b.index
      );
      const r01 = {
        index: r10.index - r00.length + r10.length,
        length: r00.length,
      };
      const r11 = {
        index: r00.index,
        length: r10.length,
      };
      return opSwapRanges([...op.path.slice(0, -1), [r11, r01]]);
    }
    case OpTypes.MOVE_RANGE: {
      const [r0, p0] = arrayLast(op.path);
      let r1, p1;
      if (r0.index < p0) {
        r1 = { index: p0 - r0.length, length: r0.length };
        p1 = r0.index;
      }
      else {
        r1 = { index: p0, length: r0.length };
        p1 = r0.index + r0.length;
      }
      return opMoveRange([...op.path.slice(0, -1), [r1, p1]])
    }
    default:
      throw new Error(`Unknown operation op '${op.op}'`);
  }
}

export function emptyHistory() {
  return [];
}

export const defaultTransaction = -1;

export function patch(state, op, newTransaction) {
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

  return combine(applyOp(state, op), history, transaction);
}

export function combine(state, history, transaction) {
  if (Array.isArray(state)) {
    state.history = history;
    state.transaction = transaction;
    return state;
  }

  return {
    ...state,
    history: history,
    transaction: transaction,
  };
}

export function hasUndo(state) {
  return state.history.length > 0 && state.transaction > defaultTransaction;
}

export function undo(state) {
  const transaction = state.transaction;

  const operations = state.history
    .filter((op) => op.transaction === transaction)
    .map((op) => inverse(op))
    .reverse();

  if (operations.length === 0) {
    throw new Error(`Nothing to undo! (transaction=${transaction})`);
  }

  return combine(applyOp(state, operations), state.history, transaction - 1);
}

export function hasRedo(state) {
  return (
    state.history.length > 0 &&
    state.transaction < arrayMax(state.history.map((op) => op.transaction))
  );
}

export function redo(state) {
  const transaction = state.transaction + 1;

  const operations = state.history.filter(
    (op) => op.transaction === transaction
  );

  if (operations.length === 0) {
    throw new Error(`Nothing to redo! (transaction=${transaction})`);
  }

  return combine(applyOp(state, operations), state.history, transaction);
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
    throw new Error(`Merge only works on single operations!`);
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

export function applyOp(obj, op) {
  if (!op) {
    return obj;
  }

  if (Array.isArray(op)) {
    return op.reduce((prev, o) => applyOp(prev, o), obj);
  }

  if (Array.isArray(obj)) {
    return applyOpArray(obj, op);
  } else {
    return applyOpObject(obj, op);
  }
}

function applyOpArray(obj, op) {
  const index = op.path[0];
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
      case OpTypes.SWAP_RANGES:
        return arraySwapRanges(obj, index);
      case OpTypes.MOVE_RANGE:
        return arrayMoveRange(obj, index);
      default:
        throw new Error(`Unknown operation op '${op.op}'`);
    }
  } else {
    return arrayReplace(obj, index, applyOp(obj[index], createOpDescend(op)));
  }
}

function applyOpObject(obj, op) {
  const result = {};
  for (const property in obj) {
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
  return [...array.slice(0, index), value, ...array.slice(index + 1)];
}

function arrayAddRange(array, index, values) {
  return [...array.slice(0, index), ...values, ...array.slice(index)];
}

function arrayAdd(array, index, value) {
  return [...array.slice(0, index), value, ...array.slice(index)];
}

function arrayRemoveRange(array, index) {
  if (typeof index !== "object") {
    throw new Error(`To remove a range, index must be an object!`);
  }
  return [
    ...array.slice(0, index.index),
    ...array.slice(index.index + index.length),
  ];
}

function arrayRemove(array, index) {
  if (typeof index !== "number") {
    throw new Error(`To remove, index must be a number!`);
  }
  return [...array.slice(0, index), ...array.slice(index + 1)];
}

function arraySwapRanges(array, ranges) {
  const [r0, r1] = arraySort(ranges, (a, b) => a.index - b.index);
  return [
    ...array.slice(0, r0.index),
    ...array.slice(r1.index, r1.index + r1.length),
    ...array.slice(r0.index + r0.length, r1.index),
    ...array.slice(r0.index, r0.index + r0.length),
    ...array.slice(r1.index + r1.length, array.length),
  ];
}

function arrayMoveRange(array, ranges) {
  const [range, pos] = ranges;

  if (pos >= range.index && pos < range.index.length) {
    throw new Error(`Can't move range inside itself!`);
  }

  if (range.index < pos) {
    return [
      ...array.slice(0, range.index),
      ...array.slice(range.index + range.length, pos),
      ...array.slice(range.index, range.index + range.length),
      ...array.slice(pos, array.length),
    ];
  } else {
    return [
      ...array.slice(0, pos),
      ...array.slice(range.index, range.index + range.length),
      ...array.slice(pos, range.index),
      ...array.slice(range.index + range.length, array.length),
    ];
  }
}

function arraySort(array, func) {
  const clone = array.slice(0);
  clone.sort(func);
  return clone;
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

function createOpDescend(operation) {
  return {
    ...operation,
    path: operation.path.slice(1),
  };
}
