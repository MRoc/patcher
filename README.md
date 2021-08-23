# Patcher

Patcher is a library for transforming immutable object trees using basic operations with
undo history and transactions.

Patcher is the result of multiple-discovery beside more versatile and mature libraries
like *Immer*: It was born from the necessity to transform a immutable state in a redux
reducer while keeping a serializeable log of events and transactions for undo and redo.
The underlying operations share similarities with JSON Patch (RFC 6902).

## Example with Redux

Example reducer using *Patcher*:

```
import { OpType, Patcher } from "@mroc/patcher";
const type = new OpType();
const patcher = new Patcher(type);

export const reducer = function (state = initialState, action) {
  switch (action.type) {
    case ActionTypes.SET_TEXT_TO_HELLO_WORLD:
      return patcher.patch(state, type.replaceOp(["text"], "Hello World"), true);
    case ActionTypes.UNDO:
        return undo(state);
    case ActionTypes.REDO:
        return redo(state);
}
```

## Patch

The `patch` function is the heart of patcher. It applies given operations *op*
to the given *state* and returns a new state. The `patch` function's parameter
`newTransaction` defines, if a new transaction should be started. All
operations in one transaction can later be undone/redone with one step:

```
function patch(state, op, newTransaction)
```

## Undo

Using `hasUndo`, `undo`, `hasRedo` and `redo`, the previous transaction can be reverted or an undone be replayed:

```
import { OpType, Patcher } from "@mroc/patcher";
const type = new OpType();
const patcher = new Patcher(type);

if (patcher.hasUndo(state0)) {
    return patcher.undo(state0);
}

if (patcher.hasRedo(state0)) {
    return patcher.redo(state0);
}
```

## Operations

Basic operations include:

* insert: `insertOp` inserts a value to an array or a property to an object.
* insertRange: `insertRangeOp` inserts an array of values into another array.
* replace: `replaceOp` replaces an element in an arrray or sets an property on an object.
* remove: `removeOp` removes an element from an array or an property from an object.
* removeRange: `removeRangeOp` removes an range for an array. Note that the last path element must be *range*.

Notes:

* All operations contain a path that describes where in the object tree the operation should be applied. Path is an array of strings that is used to descend into the object tree.
* A path can contain out of strings, numbers and sometimes objects. Strings are used to descend into an object's properties. Numbers are used to descend into an array index. Objects are used when ranges need to be specified.
* If a *range* into an array is specified, it must be an object of form `{ index: 2, length: 3}`.
* Multiple succeeding `replace` operations might be grouped in a single transaction if the last transaction only consistes out of a single `replace` on the same path.

### Insert

Insert property to object:

```
import { OpType, Patcher } from "@mroc/patcher";
const type = new OpType();
const patcher = new Patcher(type);

const state = patcher.patch({ }, type.insertOp(["property"], "value");

// { "property": "value" }
```

Inserting value into array:

```
import { OpType, Patcher } from "@mroc/patcher";
const type = new OpType();
const patcher = new Patcher(type);

const state = patcher.patch([1, 2, 3], type.insertOp([1], 4));

// [1, 2, 4, 3]
```

Note: Operations, current transaction and version is added to state:

```
{
    property: "value",
    history: {
        ops: [{ op: "insert", path: ["property"], value: "value" }],
        opsInverted: [{ op: "remove", path: ["property"]],
    },
    transaction: 0,
    version: 1
}
```

### Insert Range

Inserts an array of values into another array:

```
import { OpType, Patcher } from "@mroc/patcher";
const type = new OpType();
const patcher = new Patcher(type);

const state = { values: [1, 2, 3] };
const op = type.insertRange(["values", 1], [4, 5]);
const nextState = patcher.patch(state, op);

// [1, 2, 4, 5, 3]
```

### Replace

Replace a property value in an object:

```
import { OpType, Patcher } from "@mroc/patcher";
const type = new OpType();
const patcher = new Patcher(type);

const state = patcher.patch({ a: 2 }, type.replaceOp(["a"], 5));

// { a: 5 }
```

Replaces an element in an arrray:

```
import { OpType, Patcher } from "@mroc/patcher";
const type = new OpType();
const patcher = new Patcher(type);

const state = patcher.patch([1, 2, 3], type.replaceOp([1], 5));

// [ 1, 5, 3]
```

### Remove

Remove a property from an object:

```
import { OpType, Patcher } from "@mroc/patcher";
const type = new OpType();
const patcher = new Patcher(type);

const state = patcher.patch({ a: 1, b: 2 }, type.removeOp(["a"]));

// { b: 2 }
```

Remove an element from an arrray:

```
import { OpType, Patcher } from "@mroc/patcher";
const type = new OpType();
const patcher = new Patcher(type);

const state = patcher.patch([4, 5, 6], type.removeOp([1]));

// [4, 6]
```

### Remove Range

Removes a range of values from an array specified by index and length:

```
import { OpType, Patcher } from "@mroc/patcher";
const type = new OpType();
const patcher = new Patcher(type);

const state = [1, 2, 3, 4, 5];
const op = type.removeRange([{ index: 1, length: 2 }]);
const nextState = patcher.patch(state, op);

// [1, 4, 5]
```

### Multiple operations at once

To execute multiple operations at once, the operations need to be composed together:

```
import { OpType, Patcher } from "@mroc/patcher";
const type = new OpType();
const patcher = new Patcher(type);

const state = {
    values: [1, 2, 3]
};

const op = type.compose(
    type.insertOp(["values", 1], 4),
    type.removeOp(["values", 0])
);

const nextState = patcher.patch(state, op);
```

## Concepts

* **State**: The document state that should be transformed by operations.
* **Version**: Total number of times the state was transformed by either patch, undo or redo.
* **History**: List of operations and inverse operations applied on a state, grouped by transaction, required for undo/redo.
* **Transaction**: Number of transaction that identifies all operations in history applied to State.