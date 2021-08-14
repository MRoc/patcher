// Overlaps with https://tools.ietf.org/html/rfc6902
export const OpTypes = {
  ADD: "add",
  ADD_RANGE: "add_range",
  REPLACE: "replace",
  REMOVE: "remove",
  REMOVE_RANGE: "remove_range",
};

export function opAdd(path, value, transaction) {
  return { ...createOp(OpTypes.ADD, path, transaction), value };
}

export function opAddRange(path, value, transaction) {
  return { ...createOp(OpTypes.ADD_RANGE, path, transaction), value };
}

export function opReplace(path, value, transaction) {
  return { ...createOp(OpTypes.REPLACE, path, transaction), value };
}

export function opRemove(path, transaction) {
  return createOp(OpTypes.REMOVE, path, transaction);
}

export function opRemoveRange(path, transaction) {
  return createOp(OpTypes.REMOVE_RANGE, path, transaction);
}

function createOp(op, path, transaction) {
  const result = { op, path };
  if (transaction !== undefined) {
    result.transaction = transaction;
  }
  return result;
}

// https://github.com/Teamwork/ot-docs
export function OpType() {}

OpType.prototype.apply = function (doc, op) {
  if (!op) {
    return doc;
  }

  if (Array.isArray(op)) {
    return op.reduce((prev, o) => OpType.prototype.apply(prev, o), doc);
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
      return opRemoveRange([
        ...arraySkipLast(op.path),
        { index: arrayLast(op.path), length: op.value.length },
      ]);
    case OpTypes.REPLACE:
      return opReplace(op.path, getValue(doc, op.path), op.transaction);
    case OpTypes.REMOVE:
      return opAdd(op.path, getValue(doc, op.path), op.transaction);
    case OpTypes.REMOVE_RANGE:
      return opAddRange(
        [...arraySkipLast(op.path), arrayLast(op.path).index],
        getValue(doc, op.path),
        op.transaction
      );
    default:
      throw new Error(`Unknown operation op '${op.op}'`);
  }
};

OpType.prototype.composeSimilar = function (op1, op2) {
  // TODO Should do what canMerge does
  return null;
};

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
      default:
        throw new Error(`Unknown operation op '${op.op}'`);
    }
  } else {
    return arrayReplace(
      obj,
      index,
      OpType.prototype.apply(obj[index], createOpDescend(op))
    );
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
          result[property] = OpType.prototype.apply(
            obj[property],
            createOpDescend(op)
          );
        }
      } else {
        result[property] = obj[property];
      }
    }
  }
  if (
    (op.op === OpTypes.REPLACE || op.op === OpTypes.ADD) &&
    op.path.length === 1
  ) {
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

function createOpDescend(operation) {
  return {
    ...operation,
    path: operation.path.slice(1),
  };
}

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

function arrayLast(array) {
  return array[array.length - 1];
}

function arraySkipLast(array) {
  return array.slice(0, array.length - 1);
}
