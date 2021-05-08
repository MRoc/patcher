// Overlaps with https://tools.ietf.org/html/rfc6902
const OpTypes = {
  ADD: "add",
  ADD_RANGE: "add_range",
  SET: "replace",
  DEL: "remove",
  DEL_RANGE: "remove_range",
  SWAP: "swap",
};

export function opAdd(path, value, transaction) {
  return { op: OpTypes.ADD, transaction, path, value };
}

export function opAddRange(path, value, transaction) {
  return { op: OpTypes.ADD_RANGE, transaction, path, value };
}

export function opSet(path, value, transaction) {
  return { op: OpTypes.SET, transaction, path, value };
}

export function opDelete(path, transaction) {
  return { op: OpTypes.DEL, transaction, path };
}

export function opDeleteRange(path, transaction) {
  return { op: OpTypes.DEL_RANGE, transaction, path };
}

export function opSwap(path, transaction) {
  return { op: OpTypes.SWAP, transaction, path };
}

export function enrich(obj, op) {
  if (Array.isArray(op)) {
    return op.map((o) => enrich(obj, o));
  }

  if (
    op.op === OpTypes.SET ||
    op.op === OpTypes.DEL ||
    op.op === OpTypes.DEL_RANGE
  ) {
    return { ...op, before: getValue(obj, op.path) };
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

export function opSetEnriched(path, before, value, transaction) {
  return { ...opSet(path, value, transaction), before };
}

export function opDeleteEnriched(path, before, transaction) {
  return { ...opDelete(path, transaction), before };
}

export function opDeleteRangeEnriched(path, before, transaction) {
  return { ...opDeleteRange(path, transaction), before };
}

export function inverse(op) {
  switch (op.op) {
    case OpTypes.ADD:
      return opDelete(op.path);
    case OpTypes.ADD_RANGE:
      return opDeleteRange([
        ...arraySkipLast(op.path),
        { index: arrayLast(op.path), length: op.value.length },
      ]);
    case OpTypes.SET:
      return opSetEnriched(op.path, op.value, op.before);
    case OpTypes.DEL:
      return opAdd(op.path, op.before);
    case OpTypes.DEL_RANGE:
      return opAdd(
        [...arraySkipLast(op.path), arrayLast(op.path).index],
        op.before
      );
    case OpTypes.SWAP: {
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
      return opSwap([...op.path.slice(0, -1), [r11, r01]]);
    }
    default:
      throw new Error(`Unknown operation op '${op.op}'`);
  }
}

export function emptyHistory() {
  return [];
}

export function patch(state, op, newTransaction) {
  let history = state.history;
  let transaction = state.transaction;
  if (newTransaction) {
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

  return {
    ...applyOp(state, op),
    history: history,
    transaction: transaction,
  };
}

export function hasUndo(state) {
  return state.history.length > 0 && state.transaction > -1;
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

  return {
    ...applyOp(state, operations),
    transaction: transaction - 1,
  };
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

  return {
    ...applyOp(state, operations),
    transaction: transaction,
  };
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
  if (lastOp.op !== OpTypes.SET) {
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
      case OpTypes.SET:
        return arraySet(obj, index, op.value);
      case OpTypes.ADD:
        return arrayAdd(obj, index, op.value);
      case OpTypes.ADD_RANGE:
        return arrayAddRange(obj, index, op.value);
      case OpTypes.DEL:
        return arrayDelete(obj, index);
      case OpTypes.DEL_RANGE:
        return arrayDeleteRange(obj, index);
      case OpTypes.SWAP:
        return arraySwapRanges(obj, index);
      default:
        throw new Error(`Unknown operation op '${op.op}'`);
    }
  } else {
    return arraySet(obj, index, applyOp(obj[index], createOpDescend(op)));
  }
}

function applyOpObject(obj, op) {
  const result = {};
  for (const property in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, property)) {
      if (op.path && op.path[0] === property) {
        if (op.path.length === 1) {
          if (op.op === OpTypes.SET || op.op === OpTypes.ADD) {
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

function arraySet(array, index, value) {
  return [...array.slice(0, index), value, ...array.slice(index + 1)];
}

function arrayAddRange(array, index, values) {
  return [...array.slice(0, index), ...values, ...array.slice(index)];
}

function arrayAdd(array, index, value) {
  return [...array.slice(0, index), value, ...array.slice(index)];
}

function arrayDeleteRange(array, index) {
  if (typeof index !== "object") {
    throw new Error(`For delete a range, index must be an object!`);
  }
  return [
    ...array.slice(0, index.index),
    ...array.slice(index.index + index.length),
  ];
}

function arrayDelete(array, index) {
  if (typeof index !== "number") {
    throw new Error(`For delete, index must be a number!`);
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
