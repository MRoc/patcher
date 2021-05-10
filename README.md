# Patcher

Patcher is a library for transforming immutable object trees using basic
operations with undo history and transactions.

## Patch

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
* remove: `opRemove` removes an element from an array or an property from an object.
* removeRange: `opRemoveRange` removes an range for an array. Note that the last path element must be *range*.
* swapRanges: `opSwapRangesRanges` swaps two ranges in an array. Note that the last path elements must be a array of two *range*s.

Notes:

* All operations contain a path that describes where in the object tree the operation should be applied. Path is an array of strings that is used to descend into the object tree.
* If a *range* into an array is specified, it must be an object of form `{ index: 2, length: 3}`.
* Multiple succeeding `replace` operations might be grouped in a single transaction if the last transaction only consistes out of a single `replace` on the same path.


## Examples

### Add

Add property to object:

```
import { opAdd, patch } from "@mroc/patcher";

const state = patch ({ }, opAdd(["property"], "value");

// { "property": "value" }
```


Inserting value into array:

```
import { opAdd, patch } from "@mroc/patcher";

const state = patch([1, 2, 3], opAdd([1], 4));

// [1, 2, 4, 3]
```

Note: Operations and current transaction is added to state:

```
{
    property: "value",
    history: [
        { op: "add", path: ["property"], value: "value", transaction: 0 }
    ],
    transaction: 0
}
```

### Add Range

Inserts an array of values into another array:

```
import { opAddRange, patch } from "@mroc/patcher";

const state = { values: [1, 2, 3] };
const op = opAddRange(["values", 1], [4, 5]);
const nextState = patch(state, op);

// [1, 2, 4, 5, 3]
```

### Replace

Replace a property value in an object:

```
import { opReplace, patch } from "@mroc/patcher";

const state = patch({ a: 2 }, opReplace(["a"], 5));

// { a: 5 }
```

Replaces an element in an arrray:

```
import { opReplace, patch } from "@mroc/patcher";

const state = patch([1, 2, 3], opReplace([1], 5));

// [ 1, 5, 3]
```

### Remove

Remove a property from an object:

```
import { opRemove, patch } from "@mroc/patcher";

const state = patch({ a: 1, b: 2 }, opRemove(["a"]));

// { b: 2 }
```

Remove an element from an arrray:

```
import { opRemove, patch } from "@mroc/patcher";

const state = patch([4, 5, 6], opRemove([1]));

// [4, 6]
```

### Remove Range

Removes a range of values from an array specified by index and length:

```
import { opRemoveRange, patch } from "@mroc/patcher";

const state = [1, 2, 3, 4, 5];
const op = opRemoveRange([{ index: 1, length: 2 }]);
const nextState = patch(state, op);

// [1, 4, 5]
```

### Swap Ranges

Swaps two ranges from an array. Note the last part of path is an array of two ranges:

```
import { opSwapRanges, patch } from "@mroc/patcher";

const state = [1, 2, 3, 4, 5];
const op = opSwapRanges([[{ index: 1, length: 2 }, { index: 3, length: 2 }]]);
const nextState = patch(state, op);

// [1, 4, 5, 2, 3]
```

### Multiple operations at once

Patch also supports multiple operations at once. In that case, all operations will end
up in the same transaction:

```
import { patch } from "@mroc/patcher";

const state = {
    values: [1, 2, 3]
};

const nextState = patch(state, [
    opAdd(["values", 1], 4),
    opRemove(["values", 0]),
]);
```

## Undo and Redo

Using `undo` and `redo`, the previous transaction can be reverted or an undone be replayed:

```
import { undo, redo } from "@mroc/patcher";

const state1 = undo(state0);
const state2 = redo(state1);

// state1 equals state 0
```

## Concepts

All operations can be undone by creating a inverse operation using the `inverse` function.
This is usually done internally in `undo` and `redo`. An interesting fact is that certain
operations need previous state to be undone, for example `replace` because obviously after
replace, the previous value is lost. For that, operations are *enriched* before placed
into the history using the `enrich` function. This function adds a `previous` property
to all operations that require it.