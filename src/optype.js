// Overlaps with https://tools.ietf.org/html/rfc6902
export const OpTypes = {
  INSERT: "insert",
  INSERT_RANGE: "insert_range",
  REPLACE: "replace",
  REMOVE: "remove",
  REMOVE_RANGE: "remove_range",
};

// https://github.com/Teamwork/ot-docs
export function OpType() {}

OpType.prototype.insertOp = function (path, value) {
  return { ...createOp(OpTypes.INSERT, path), value };
};

OpType.prototype.insertRangeOp = function (path, value) {
  return { ...createOp(OpTypes.INSERT_RANGE, path), value };
};

OpType.prototype.replaceOp = function (path, value) {
  return { ...createOp(OpTypes.REPLACE, path), value };
};

OpType.prototype.removeOp = function (path) {
  return createOp(OpTypes.REMOVE, path);
};

OpType.prototype.removeRangeOp = function (path) {
  return createOp(OpTypes.REMOVE_RANGE, path);
};

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
  if (Array.isArray(op)) {
    return op.map((o) => this.invertWithDoc(o, doc));
  }
  switch (op.op) {
    case OpTypes.INSERT:
      return this.removeOp(op.path);
    case OpTypes.INSERT_RANGE:
      return this.removeRangeOp([
        ...arraySkipLast(op.path),
        { index: arrayLast(op.path), length: op.value.length },
      ]);
    case OpTypes.REPLACE:
      return this.replaceOp(op.path, getValue(doc, op.path));
    case OpTypes.REMOVE:
      return this.insertOp(op.path, getValue(doc, op.path));
    case OpTypes.REMOVE_RANGE:
      return this.insertRangeOp(
        [...arraySkipLast(op.path), arrayLast(op.path).index],
        getValue(doc, op.path)
      );
    default:
      throw new Error(`Unknown operation op '${op.op}'`);
  }
};

OpType.prototype.compose = function (op1, op2) {
  if (!Array.isArray(op1)) {
    op1 = [op1];
  }
  if (!Array.isArray(op2)) {
    op2 = [op2];
  }
  // Default compose is concatenating operations
  return [...op1, ...op2];
};

OpType.prototype.composeSimilar = function (op1, op2) {
  if (!Array.isArray(op1)) {
    op1 = [op1];
  }
  if (!Array.isArray(op2)) {
    op2 = [op2];
  }

  // Compose two replace on the same path by just taking the second operation.
  if (
    op1.length === 1 &&
    op2.length === 1 &&
    op1[0].op === OpTypes.REPLACE &&
    op2[0].op === OpTypes.REPLACE &&
    arrayEquals(op1[0].path, op2[0].path)
  ) {
    return op2[0];
  }
  return null;
};

function applyOpArray(obj, op) {
  const index = op.path[0];
  if (op.path.length === 1) {
    switch (op.op) {
      case OpTypes.REPLACE:
        return arrayReplace(obj, index, op.value);
      case OpTypes.INSERT:
        return arrayAdd(obj, index, op.value);
      case OpTypes.INSERT_RANGE:
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
          if (op.op === OpTypes.REPLACE || op.op === OpTypes.INSERT) {
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
    (op.op === OpTypes.REPLACE || op.op === OpTypes.INSERT) &&
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

function createOp(op, path) {
  return { op, path };
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
