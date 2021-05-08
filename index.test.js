import {
  createOpAdd,
  createOpAddRange,
  createOpSet,
  createOpSetEnriched,
  createOpDelete,
  createOpDeleteEnriched,
  createOpDeleteRange,
  createOpDeleteRangeEnriched,
  createOpSwap,
  createOpEnriched,
  createOpInverse,
  canMergeOp,
  applyOp,
  mergeLastOp,
  discardFutureOps,
  addOp,
} from "./index.js";

describe("createOpEnriched", () => {
  test("With single set stores previous value", () => {
    const obj = [{ a: 0 }];
    const op = createOpSet([0, "a"], 1, 2, 3);
    const opEnriched = createOpEnriched(obj, op);
    expect(opEnriched.before).toBe(0);
  });
  test("With multiple sets stores previous values", () => {
    const obj = [{ a: 0 }, { a: 1 }];
    const op = [createOpSet([0, "a"], 2, 2), createOpSet([1, "a"], 3, 2)];
    const opEnriched = createOpEnriched(obj, op);
    expect(opEnriched).toStrictEqual([
      createOpSetEnriched([0, "a"], 0, 2, 2),
      createOpSetEnriched([1, "a"], 1, 3, 2),
    ]);
  });
  test("With single delete stores previous value", () => {
    const obj = [{ a: "A" }];
    const op = createOpDelete([0, "a"]);
    const opEnriched = createOpEnriched(obj, op);
    expect(opEnriched.before).toBe("A");
  });
  test("With single delete range stores previous value", () => {
    const obj = [1, 2, 3, 4];
    const op = createOpDeleteRange([{ index: 1, length: 2 }]);
    const opEnriched = createOpEnriched(obj, op);
    expect(opEnriched.before).toEqual([2, 3]);
  });
});

describe("createOpInverse", () => {
  test("With add returns inverse delete", () => {
    const op = createOpAdd(["a", "b"], "c");
    const inverse = createOpInverse(op);
    expect(inverse).toStrictEqual(createOpDelete(["a", "b"]));
  });
  test("With add-range returns inverse delete-range", () => {
    const op = createOpAddRange(["a", 1], ["c", "d"]);
    const inverse = createOpInverse(op);
    expect(inverse).toStrictEqual(
      createOpDeleteRange(["a", { index: 1, length: 2 }])
    );
  });
  test("With set returns inverse set", () => {
    const op = createOpSetEnriched(["a", "b"], "c", "d");
    const inverse = createOpInverse(op);
    expect(inverse).toStrictEqual(createOpSetEnriched(["a", "b"], "d", "c"));
  });
  test("With delete returns inverse add", () => {
    const op = createOpDeleteEnriched(["a", "b"], "X");
    const inverse = createOpInverse(op);
    expect(inverse).toStrictEqual(createOpAdd(["a", "b"], "X"));
  });
  test("With delete-range returns inverse add", () => {
    const op = createOpDeleteRangeEnriched(
      ["a", { index: 1, length: 2 }],
      ["X", "Y"]
    );
    const inverse = createOpInverse(op);
    expect(inverse).toStrictEqual(createOpAdd(["a", 1], ["X", "Y"]));
  });
  test("With swap returns inverse swap", () => {
    const op = createOpSwap([
      "a",
      [
        { index: 1, length: 2 },
        { index: 3, length: 1 },
      ],
    ]);
    const inverse = createOpInverse(op);

    const expectedOp = createOpSwap([
      "a",
      [
        { index: 1, length: 1 },
        { index: 2, length: 2 },
      ],
    ]);
    expect(inverse).toStrictEqual(expectedOp);
  });
});

describe("canMergeOp", () => {
  test("With no last operations returns false", () => {
    const history = [];
    const transaction = -1;
    const operation = createOpSet(["a"], 0, 1);
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(false);
  });
  test("With last operation not being set returns false", () => {
    const history = [createOpAdd(["a", "value"], "b", 0)];
    const transaction = 0;
    const operation = createOpSet(["a"], 0, 1);
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(false);
  });
  test("With last operation path not equal returns false", () => {
    const history = [createOpSet(["b"], 1, 0)];
    const transaction = 0;
    const operation = createOpSet(["a"], 0, 1);
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(false);
  });
  test("With two operations returns false", () => {
    const history = [createOpSet(["b"], 1, 0)];
    const transaction = 0;
    const operation = [createOpSet(["a"], 0, 1), createOpSet(["b"], 0, 1)];
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(false);
  });
  test("With set on same path and single op returns true", () => {
    const history = [createOpSet(["b", "c"], 1, 0)];
    const transaction = 0;
    const operation = createOpSet(["b", "c"], 2, 0);
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(true);
  });
  test("With set on same path in array and single op returns true", () => {
    const history = [createOpSet(["b", "c"], 1, 0)];
    const transaction = 0;
    const operation = [createOpSet(["b", "c"], 2, 0)];
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(true);
  });
});

describe("mergeLastOp", () => {
  test("With last operation merge-able, overwrites value", () => {
    const history = [createOpSet(["a", "b"], 1, 0)];
    const operation = createOpSet(["a", "b"], 2, 0);
    const mergedHistory = mergeLastOp(history, operation);
    expect(mergedHistory).toStrictEqual([createOpSet(["a", "b"], 2, 0)]);
  });
});

describe("discardFutureOps", () => {
  test("With history removes operations from the future", () => {
    const history = [
      createOpSet(["a", "b"], 1, 0),
      createOpSet(["a", "b"], 2, 1),
      createOpSet(["a", "b"], 3, 2),
    ];
    const newHistory = discardFutureOps(history, 1);
    expect(newHistory).toStrictEqual([history[0]]);
  });
});

describe("addOp", () => {
  test("With history adds single operation with transaction", () => {
    const history = [createOpSet(["a"], 1, 0)];
    const operation = createOpSet(["b"], 2);
    const transaction = 5;
    const newHistory = addOp(history, transaction, operation);
    expect(newHistory).toStrictEqual([
      createOpSet(["a"], 1, 0),
      createOpSet(["b"], 2, 5),
    ]);
  });
  test("With history adds multiple operations with transaction", () => {
    const history = [createOpSet(["a"], 1, 0)];
    const operation = [createOpSet(["b"], 2, 0), createOpSet(["c"], 3, 0)];
    const transaction = 5;
    const newHistory = addOp(history, transaction, operation);
    expect(newHistory).toStrictEqual([
      createOpSet(["a"], 1, 0),
      createOpSet(["b"], 2, 5),
      createOpSet(["c"], 3, 5),
    ]);
  });
});

describe("applyOp", () => {
  test("With none returns original object", () => {
    const input = { a: 1, b: 2 };
    const clone = applyOp(input);
    expect(clone).toStrictEqual(input);
  });
  test("With add to object adds proptery", () => {
    const input = { a: 1, b: 2 };
    const clone = applyOp(input, createOpAdd(["c"], 3));
    expect(clone).toStrictEqual({ a: 1, b: 2, c: 3 });
  });
  test("With add to nested object adds property", () => {
    const input = { a: { b: { c: 1 } }, b: 2 };
    const clone = applyOp(input, createOpAdd(["a", "b", "d"], 3));
    expect(clone).toStrictEqual({ a: { b: { c: 1, d: 3 } }, b: 2 });
  });
  test("With add to array inserts into array", () => {
    const input = [1, 2, 3];
    const clone = applyOp(input, createOpAdd([1], 4));
    expect(clone).toStrictEqual([1, 4, 2, 3]);
  });
  test("With add nested array inserts into array", () => {
    const input = [{ a: [1, 2] }, { b: [3, 4] }];
    const clone = applyOp(input, createOpAdd([0, "a", 1], 5));
    expect(clone).toStrictEqual([{ a: [1, 5, 2] }, { b: [3, 4] }]);
  });
  test("With add-range to array inserts flat", () => {
    const input = [1, 2, 3];
    const clone = applyOp(input, createOpAddRange([1], [4, 5]));
    expect(clone).toStrictEqual([1, 4, 5, 2, 3]);
  });
  test("With set on object sets property", () => {
    const input = { a: 1, b: 2 };
    const clone = applyOp(input, createOpSet(["a"], 3));
    expect(clone).toStrictEqual({ a: 3, b: 2 });
  });
  test("With set on nested object sets property", () => {
    const input = { a: { b: { c: 1 } }, b: 2 };
    const clone = applyOp(input, createOpSet(["a", "b", "c"], 3));
    expect(clone).toStrictEqual({ a: { b: { c: 3 } }, b: 2 });
  });
  test("With set on array changes single value", () => {
    const input = [1, 2, 3];
    const clone = applyOp(input, createOpSet([1], 4));
    expect(clone).toStrictEqual([1, 4, 3]);
  });
  test("With set on nested array changes single value", () => {
    const input = [{ a: 1 }, { b: 2 }, { c: 3 }];
    const clone = applyOp(input, createOpSet([1, "b"], 4));
    expect(clone).toStrictEqual([{ a: 1 }, { b: 4 }, { c: 3 }]);
  });
  test("With delete on object deletes property", () => {
    const input = { a: 1, b: 2 };
    const clone = applyOp(input, createOpDelete(["a"]));
    expect(clone).toStrictEqual({ b: 2 });
  });
  test("With delete on nested object deletes property", () => {
    const input = { a: { b: { c: 1 } }, b: 2 };
    const clone = applyOp(input, createOpDelete(["a", "b", "c"]));
    expect(clone).toStrictEqual({ a: { b: {} }, b: 2 });
  });
  test("With delete on array removes single value", () => {
    const input = [1, 2, 3];
    const clone = applyOp(input, createOpDelete([1]));
    expect(clone).toStrictEqual([1, 3]);
  });
  test("With delete on nested array removes single value", () => {
    const input = [{ a: [1, 2] }, { b: [3, 4] }];
    const clone = applyOp(input, createOpDelete([0, "a", 1], 2));
    expect(clone).toStrictEqual([{ a: [1] }, { b: [3, 4] }]);
  });
  test("With delete-range from array removes multiple values", () => {
    const input = [1, 2, 3, 4, 5];
    const clone = applyOp(
      input,
      createOpDeleteRange([{ index: 1, length: 2 }])
    );
    expect(clone).toStrictEqual([1, 4, 5]);
  });
  test("With swap of two single value", () => {
    const input = [1, 2, 3, 4, 5];
    const clone = applyOp(
      input,
      createOpSwap([
        [
          { index: 1, length: 1 },
          { index: 3, length: 1 },
        ],
      ])
    );
    expect(clone).toStrictEqual([1, 4, 3, 2, 5]);
  });
  test("With swap of two ranges", () => {
    const input = [1, 2, 3, 4, 5];
    const clone = applyOp(
      input,
      createOpSwap([
        [
          { index: 0, length: 2 },
          { index: 3, length: 2 },
        ],
      ])
    );
    expect(clone).toStrictEqual([4, 5, 3, 1, 2]);
  });
  test("With swap of two ranges in object", () => {
    const input = { arr: [1, 2, 3, 4, 5] };
    const clone = applyOp(
      input,
      createOpSwap([
        "arr",
        [
          { index: 0, length: 2 },
          { index: 3, length: 2 },
        ],
      ])
    );
    expect(clone).toStrictEqual({ arr: [4, 5, 3, 1, 2] });
  });
  test("With multiple operations applies after each other", () => {
    const input = { a: 1, b: 2 };
    const clone = applyOp(input, [
      createOpSet(["a"], 3),
      createOpSet(["b"], 4),
    ]);
    expect(clone).toStrictEqual({ a: 3, b: 4 });
  });
  test("With succeeding adds adds one after another", () => {
    const input = [1, 2];
    const clone = applyOp(input, [createOpAdd([2], 3), createOpAdd([3], 4)]);
    expect(clone).toStrictEqual([1, 2, 3, 4]);
  });
});
