# Patcher

Patcher is a library for transforming immutable object trees using simple operations with undo history and transactions.

## patch

The `patch` function is the heart of patcher. It applies given operations
to the given state and returns a new state. The `patch` function's parameter
`newTransaction` defines, if a new transaction should be started. All
operations in one transaction can later be undone/redone with one step:

```
function patch(state, op, newTransaction)
```

## Operations

Basic operations include:

* add: `opAdd` adds a value to an array or a property to an object.
* addRange: `opAddRange` inserts an array of values into another array.
* replace: `opReplace` replaces an element in an arrray or sets an property on an object.
* delete: `opDelete` removes an element from an array or an property from an object.
* deleteRange: `opDeleteRange` removes an range for an array. Note that the last path element must be *range*.
* swap: `opSwap` swaps two ranges in an array. Note that the last path elements must be a array of two *range*s.

Note: If a *range* into an array is specified, it must be an object of form `{ index: 2, length: 3}`.

All operations contain a path that describes where in the object tree the operation should be applied. 

## Example

For example, adding a range of values to an array nested in an object:

```
import { patch } from "@mroc/patcher";

const state = {
    values: [1, 2, 3]
};

const nextState = patch(state, opAddRange(["values", 1], [4, 5]));
```

Results in the following new state. Note: All operations and the current transaction is stored in the state.

```
{
    values: [1, 2, 4, 5, 3],
    history: [
        { op: "add_range", path: ["values", 1], value: [4, 5], transaction: 0 }
    ],
    transaction: 0
}
```

Patch also supports multiple operations at once:

```
import { patch } from "@mroc/patcher";

const state = {
    values: [1, 2, 3]
};

const nextState = patch(state, [
    opAdd(["values", 1], 4),
    opDelete(["values", 0]),
]);
```

## undo/redo

Undoing and redo all operations from last transaction is as easy as:

```
import { undo } from "@mroc/patcher";

const previousState = undo(nextState);
const nextState2 = redo(previousState);
```