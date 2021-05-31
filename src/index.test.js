import {
  opAdd,
  opAddRange,
  opReplace,
  opReplaceEnriched,
  opRemove,
  opRemoveEnriched,
  opRemoveRange,
  opRemoveRangeEnriched,
  opMoveRange,
  patch,
  undo,
  redo,
  enrich,
  inverse,
  combine,
  canMergeOp,
  applyOp,
  mergeLastOp,
  discardFutureOps,
  addOp,
} from "./index.js";

describe("enrich", () => {
  test("With single replace stores previous value", () => {
    const obj = [{ a: 0 }];
    const op = opReplace([0, "a"], 1, 2, 3);
    const opEnriched = enrich(obj, op);
    expect(opEnriched.previous).toBe(0);
  });
  test("With multiple replace stores previous values", () => {
    const obj = [{ a: 0 }, { a: 1 }];
    const op = [opReplace([0, "a"], 2, 2), opReplace([1, "a"], 3, 2)];
    const opEnriched = enrich(obj, op);
    expect(opEnriched).toStrictEqual([
      opReplaceEnriched([0, "a"], 0, 2, 2),
      opReplaceEnriched([1, "a"], 1, 3, 2),
    ]);
  });
  test("With single remove stores previous value", () => {
    const obj = [{ a: "A" }];
    const op = opRemove([0, "a"]);
    const opEnriched = enrich(obj, op);
    expect(opEnriched.previous).toBe("A");
  });
  test("With single remove range stores previous value", () => {
    const obj = [1, 2, 3, 4];
    const op = opRemoveRange([{ index: 1, length: 2 }]);
    const opEnriched = enrich(obj, op);
    expect(opEnriched.previous).toEqual([2, 3]);
  });
});

describe("inverse", () => {
  test("With add returns inverse remove", () => {
    const op = opAdd(["a", "b"], "c");
    const inverseOp = inverse(op);
    expect(inverseOp).toStrictEqual(opRemove(["a", "b"]));
  });
  test("With add-range returns inverse remove-range", () => {
    const op = opAddRange(["a", 1], ["c", "d"]);
    const inverseOp = inverse(op);
    expect(inverseOp).toStrictEqual(
      opRemoveRange(["a", { index: 1, length: 2 }])
    );
  });
  test("With replace returns inverse replace", () => {
    const op = opReplaceEnriched(["a", "b"], "c", "d");
    const inverseOp = inverse(op);
    expect(inverseOp).toStrictEqual(opReplaceEnriched(["a", "b"], "d", "c"));
  });
  test("With remove returns inverse add", () => {
    const op = opRemoveEnriched(["a", "b"], "X");
    const inverseOp = inverse(op);
    expect(inverseOp).toStrictEqual(opAdd(["a", "b"], "X"));
  });
  test("With remove-range returns inverse add", () => {
    const op = opRemoveRangeEnriched(
      ["a", { index: 1, length: 2 }],
      ["X", "Y"]
    );
    const inverseOp = inverse(op);
    expect(inverseOp).toStrictEqual(opAddRange(["a", 1], ["X", "Y"]));
  });
  test("With move-range to right returns inverse move-range", () => {
    const op = opMoveRange(["a", [{ index: 1, length: 2 }, 4]]);
    const inverseOp = inverse(op);
    const expectedOp = opMoveRange(["a", [{ index: 2, length: 2 }, 1]]);
    expect(inverseOp).toStrictEqual(expectedOp);
  });
  test("With move-range to left returns inverse move-range", () => {
    const op = opMoveRange(["a", [{ index: 2, length: 2 }, 1]]);
    const inverseOp = inverse(op);
    const expectedOp = opMoveRange(["a", [{ index: 1, length: 2 }, 4]]);
    expect(inverseOp).toStrictEqual(expectedOp);
  });
});

describe("canMergeOp", () => {
  test("With no last operations returns false", () => {
    const history = [];
    const transaction = -1;
    const operation = opReplace(["a"], 0, 1);
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(false);
  });
  test("With last operation not being replace returns false", () => {
    const history = [opAdd(["a", "value"], "b", 0)];
    const transaction = 0;
    const operation = opReplace(["a"], 0, 1);
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(false);
  });
  test("With last operation path not equal returns false", () => {
    const history = [opReplace(["b"], 1, 0)];
    const transaction = 0;
    const operation = opReplace(["a"], 0, 1);
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(false);
  });
  test("With two operations returns false", () => {
    const history = [opReplace(["b"], 1, 0)];
    const transaction = 0;
    const operation = [opReplace(["a"], 0, 1), opReplace(["b"], 0, 1)];
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(false);
  });
  test("With replace on same path and single op returns true", () => {
    const history = [opReplace(["b", "c"], 1, 0)];
    const transaction = 0;
    const operation = opReplace(["b", "c"], 2, 0);
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(true);
  });
  test("With replace on same path in array and single op returns true", () => {
    const history = [opReplace(["b", "c"], 1, 0)];
    const transaction = 0;
    const operation = [opReplace(["b", "c"], 2, 0)];
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(true);
  });
});

describe("mergeLastOp", () => {
  test("With last operation merge-able, overwrites value", () => {
    const history = [opReplace(["a", "b"], 1, 0)];
    const operation = opReplace(["a", "b"], 2, 0);
    const mergedHistory = mergeLastOp(history, operation);
    expect(mergedHistory).toStrictEqual([opReplace(["a", "b"], 2, 0)]);
  });
});

describe("discardFutureOps", () => {
  test("With history removes operations from the future", () => {
    const history = [
      opReplace(["a", "b"], 1, 0),
      opReplace(["a", "b"], 2, 1),
      opReplace(["a", "b"], 3, 2),
    ];
    const newHistory = discardFutureOps(history, 1);
    expect(newHistory).toStrictEqual([history[0]]);
  });
});

describe("addOp", () => {
  test("With history adds single operation with transaction", () => {
    const history = [opReplace(["a"], 1, 0)];
    const operation = opReplace(["b"], 2);
    const transaction = 5;
    const newHistory = addOp(history, transaction, operation);
    expect(newHistory).toStrictEqual([
      opReplace(["a"], 1, 0),
      opReplace(["b"], 2, 5),
    ]);
  });
  test("With history adds multiple operations with transaction", () => {
    const history = [opReplace(["a"], 1, 0)];
    const operation = [opReplace(["b"], 2, 0), opReplace(["c"], 3, 0)];
    const transaction = 5;
    const newHistory = addOp(history, transaction, operation);
    expect(newHistory).toStrictEqual([
      opReplace(["a"], 1, 0),
      opReplace(["b"], 2, 5),
      opReplace(["c"], 3, 5),
    ]);
  });
});

describe("applyOp", () => {
  test("With none returns original object", () => {
    const input = { a: 1, b: 2 };
    const clone = applyOp(input);
    expect(clone).toStrictEqual(input);
  });
  test("With add to object adds property", () => {
    const input = { a: 1, b: 2 };
    const clone = applyOp(input, opAdd(["c"], 3));
    expect(clone).toStrictEqual({ a: 1, b: 2, c: 3 });
  });
  test("With add to nested object adds property", () => {
    const input = { a: { b: { c: 1 } }, b: 2 };
    const clone = applyOp(input, opAdd(["a", "b", "d"], 3));
    expect(clone).toStrictEqual({ a: { b: { c: 1, d: 3 } }, b: 2 });
  });
  test("With add to array inserts into array", () => {
    const input = [1, 2, 3];
    const clone = applyOp(input, opAdd([1], 4));
    expect(clone).toStrictEqual([1, 4, 2, 3]);
  });
  test("With add to nested array inserts into array", () => {
    const input = [{ a: [1, 2] }, { b: [3, 4] }];
    const clone = applyOp(input, opAdd([0, "a", 1], 5));
    expect(clone).toStrictEqual([{ a: [1, 5, 2] }, { b: [3, 4] }]);
  });
  test("With add-range to array inserts flat", () => {
    const input = [1, 2, 3];
    const clone = applyOp(input, opAddRange([1], [4, 5]));
    expect(clone).toStrictEqual([1, 4, 5, 2, 3]);
  });
  test("With replace on object replaces property", () => {
    const input = { a: 1, b: 2 };
    const clone = applyOp(input, opReplace(["a"], 3));
    expect(clone).toStrictEqual({ a: 3, b: 2 });
  });
  test("With replace on array changes single value", () => {
    const input = [1, 2, 3];
    const clone = applyOp(input, opReplace([1], 4));
    expect(clone).toStrictEqual([1, 4, 3]);
  });
  test("With remove on object deletes property", () => {
    const input = { a: 1, b: 2 };
    const clone = applyOp(input, opRemove(["a"]));
    expect(clone).toStrictEqual({ b: 2 });
  });
  test("With remove on array removes single value", () => {
    const input = [1, 2, 3];
    const clone = applyOp(input, opRemove([1]));
    expect(clone).toStrictEqual([1, 3]);
  });
  test("With remove-range from array removes multiple values", () => {
    const input = [1, 2, 3, 4, 5];
    const clone = applyOp(input, opRemoveRange([{ index: 1, length: 2 }]));
    expect(clone).toStrictEqual([1, 4, 5]);
  });
  test("With move-range to right", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const clone = applyOp(input, opMoveRange([[{ index: 1, length: 2 }, 4]]));
    expect(clone).toStrictEqual([1, 4, 2, 3, 5, 6]);
  });
  test("With move-range to left", () => {
    const input = [1, 4, 2, 3, 5, 6];
    const clone = applyOp(input, opMoveRange([[{ index: 2, length: 2 }, 1]]));
    expect(clone).toStrictEqual([1, 2, 3, 4, 5, 6]);
  });
  test("With multiple operations applies after each other", () => {
    const input = { a: 1, b: 2 };
    const clone = applyOp(input, [opReplace(["a"], 3), opReplace(["b"], 4)]);
    expect(clone).toStrictEqual({ a: 3, b: 4 });
  });
  test("With succeeding adds adds one after another", () => {
    const input = [1, 2];
    const clone = applyOp(input, [opAdd([2], 3), opAdd([3], 4)]);
    expect(clone).toStrictEqual([1, 2, 3, 4]);
  });
});

describe("patch", () => {
  test("With add to object, starts transaction, adds to history, adds property", () => {
    const state = {};
    const op = opAdd(["a"], 2);
    const clone = patch(state, op);
    expect(clone).toStrictEqual(combine({ a: 2 }, [opAdd(["a"], 2, 0)], 0, 1));
  });
  test("With add to array, starts transaction, adds to history, adds element", () => {
    const state = [1, 2, 3];
    const op = opAdd([1], 5);
    const clone = patch(state, op);
    expect(clone.slice(0)).toStrictEqual([1, 5, 2, 3]);
    expect(clone.history.length).toBe(1);
    expect(clone.transaction).toBe(0);
  });
  test("With add-range to array, starts transaction, adds to history, adds elements", () => {
    const state = [1, 2, 3];
    const op = opAddRange([1], [4, 5]);
    const clone = patch(state, op);
    expect(clone.slice(0)).toStrictEqual([1, 4, 5, 2, 3]);
    expect(clone.history.length).toBe(1);
    expect(clone.transaction).toBe(0);
  });
  test("With remove from object, starts transaction, adds to history, removes property", () => {
    const state = { a: 2 };
    const op = opRemove(["a"]);
    const clone = patch(state, op);
    expect(clone).toStrictEqual(
      combine({}, [opRemoveEnriched(["a"], 2, 0)], 0, 1)
    );
  });
  test("With remove from array, starts transaction, adds to history, removes element", () => {
    const state = [1, 2, 5, 3];
    const op = opRemove([2]);
    const clone = patch(state, op);
    expect(clone.slice(0)).toStrictEqual([1, 2, 3]);
    expect(clone.history.length).toBe(1);
    expect(clone.transaction).toBe(0);
  });
  test("With remove-range from array, starts transaction, adds to history, removes elements", () => {
    const state = [1, 2, 5, 3];
    const op = opRemoveRange([{ index: 1, length: 2 }]);
    const clone = patch(state, op);
    expect(clone.slice(0)).toStrictEqual([1, 3]);
    expect(clone.history.length).toBe(1);
    expect(clone.transaction).toBe(0);
  });
  // TODO This case is not implemented yet and differs from JSON patch RFC
  // test("With replace on object empty, starts transaction, adds to history, creates property", () => {
  //   const state = { };
  //   const op = opReplace(["a"], 3);
  //   const clone = patch(state, op);
  //   expect(clone).toStrictEqual({
  //     a: 3,
  //     history: [opReplaceEnriched(["a"], undefined, 3, 0)],
  //     transaction: 0,
  //   });
  // });
  test("With replace on object, starts transaction, adds to history, updates property", () => {
    const state = { a: 2 };
    const op = opReplace(["a"], 3);
    const clone = patch(state, op);
    expect(clone).toStrictEqual(
      combine({ a: 3 }, [opReplaceEnriched(["a"], 2, 3, 0)], 0, 1)
    );
  });
  test("With replace on array, starts transaction, adds to history, updates element", () => {
    const state = [1, 2, 5, 3];
    const op = opReplace([2], 4);
    const clone = patch(state, op);
    expect(clone.slice(0)).toStrictEqual([1, 2, 4, 3]);
    expect(clone.history.length).toBe(1);
    expect(clone.transaction).toBe(0);
  });
  test("With two sets, increments version twice", () => {
    const clone = patch({}, [opAdd(["a"], 2), opAdd(["a"], 2)]);
    expect(clone.version).toBe(2);
  });
});

describe("undo", () => {
  test("With add to object, removes property and decrements transaction", () => {
    const state = combine({ a: 2 }, [opAdd(["a"], 2, 0)], 0);
    const clone = undo(state);
    expect(clone).toStrictEqual(combine({}, [opAdd(["a"], 2, 0)], -1, 1));
  });
  test("With add to array, removes element and decrements transaction", () => {
    const state = combine([1, 2, 5, 3], [opAdd([2], 5, 0)], 0);
    const clone = undo(state);
    expect(clone.slice(0)).toStrictEqual([1, 2, 3]);
  });
  test("With add-range to array,removes elements and decrements transaction", () => {
    const state = combine([1, 4, 5, 2, 3], [opAddRange([1], [4, 5], 0)], 0);
    const clone = undo(state);
    expect(clone.slice(0)).toStrictEqual([1, 2, 3]);
  });
  test("With remove from object, adds property and decrements transaction", () => {
    const state = combine({}, [opRemoveEnriched(["a"], 2, 0)], 0);
    const clone = undo(state);
    expect(clone).toStrictEqual(
      combine({ a: 2 }, [opRemoveEnriched(["a"], 2, 0)], -1, 1)
    );
  });
  test("With remove from array, adds element and decrements transaction", () => {
    const state = combine([1, 2, 3], [opRemoveEnriched([2], 5, 0)], 0);
    const clone = undo(state);
    expect(clone.slice(0)).toStrictEqual([1, 2, 5, 3]);
  });
  test("With remove-range from array, adds elements and decrements transaction", () => {
    const state = combine(
      [1, 3],
      [opRemoveRangeEnriched([{ index: 1, length: 2 }], [2, 5], 0)],
      0
    );
    const clone = undo(state);
    expect(clone.slice(0)).toStrictEqual([1, 2, 5, 3]);
  });
  test("With replace on object, updates property and decrements transaction", () => {
    const state = combine({ a: 3 }, [opReplaceEnriched(["a"], 2, 3, 0)], 0);
    const clone = undo(state);
    expect(clone).toStrictEqual(
      combine({ a: 2 }, [opReplaceEnriched(["a"], 2, 3, 0)], -1, 1)
    );
  });
  test("With replace on array, updates element and decrements transaction", () => {
    const state = combine([1, 4, 3], [opReplaceEnriched([1], 2, 4, 0)], 0);
    const clone = undo(state);
    expect(clone.slice(0)).toStrictEqual([1, 2, 3]);
  });
});

describe("redo", () => {
  test("With add to object, adds property and increments transaction", () => {
    const state = combine({}, [opAdd(["a"], 2, 0)], -1);
    const clone = redo(state);
    expect(clone).toStrictEqual(combine({ a: 2 }, [opAdd(["a"], 2, 0)], 0, 1));
  });
  test("With add to array, add element and increments transaction", () => {
    const state = combine([1, 2, 3], [opAdd([2], 4, 0)], -1);
    const clone = redo(state);
    expect(clone.slice(0)).toStrictEqual([1, 2, 4, 3]);
  });
  test("With add-range to array, adds elements and increments transaction", () => {
    const state = combine([1, 2, 3], [opAddRange([1], [4, 5], 0)], -1);
    const clone = redo(state);
    expect(clone.slice(0)).toStrictEqual([1, 4, 5, 2, 3]);
  });
  test("With remove from object, removes property and increments transaction", () => {
    const state = combine({ a: 2 }, [opRemoveEnriched(["a"], 2, 0)], -1);
    const clone = redo(state);
    expect(clone).toStrictEqual(
      combine({}, [opRemoveEnriched(["a"], 2, 0)], 0, 1)
    );
  });
  test("With remove from array, removes element and increments transaction", () => {
    const state = combine([1, 2, 4, 3], [opRemoveEnriched([2], 4, 0)], -1);
    const clone = redo(state);
    expect(clone.slice(0)).toStrictEqual([1, 2, 3]);
  });
  test("With replace on object, updates property and increments transaction", () => {
    const state = combine({ a: 2 }, [opReplaceEnriched(["a"], 2, 3, 0)], -1);
    const clone = redo(state);
    expect(clone).toStrictEqual(
      combine({ a: 3 }, [opReplaceEnriched(["a"], 2, 3, 0)], 0, 1)
    );
  });
  test("With replace on array, updates element and increments transaction", () => {
    const state = combine([1, 2, 3], [opReplaceEnriched([1], 2, 5, 0)], -1);
    const clone = redo(state);
    expect(clone.slice(0)).toStrictEqual([1, 5, 3]);
  });
});
