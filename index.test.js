import {
  opAdd,
  opAddRange,
  opSet,
  opSetEnriched,
  opDelete,
  opDeleteEnriched,
  opDeleteRange,
  opDeleteRangeEnriched,
  opSwap,
  enrich,
  inverse,
  canMergeOp,
  applyOp,
  mergeLastOp,
  discardFutureOps,
  addOp,
} from "./index.js";

describe("enrich", () => {
  test("With single set stores previous value", () => {
    const obj = [{ a: 0 }];
    const op = opSet([0, "a"], 1, 2, 3);
    const opEnriched = enrich(obj, op);
    expect(opEnriched.before).toBe(0);
  });
  test("With multiple sets stores previous values", () => {
    const obj = [{ a: 0 }, { a: 1 }];
    const op = [opSet([0, "a"], 2, 2), opSet([1, "a"], 3, 2)];
    const opEnriched = enrich(obj, op);
    expect(opEnriched).toStrictEqual([
      opSetEnriched([0, "a"], 0, 2, 2),
      opSetEnriched([1, "a"], 1, 3, 2),
    ]);
  });
  test("With single delete stores previous value", () => {
    const obj = [{ a: "A" }];
    const op = opDelete([0, "a"]);
    const opEnriched = enrich(obj, op);
    expect(opEnriched.before).toBe("A");
  });
  test("With single delete range stores previous value", () => {
    const obj = [1, 2, 3, 4];
    const op = opDeleteRange([{ index: 1, length: 2 }]);
    const opEnriched = enrich(obj, op);
    expect(opEnriched.before).toEqual([2, 3]);
  });
});

describe("inverse", () => {
  test("With add returns inverse delete", () => {
    const op = opAdd(["a", "b"], "c");
    const inverseOp = inverse(op);
    expect(inverseOp).toStrictEqual(opDelete(["a", "b"]));
  });
  test("With add-range returns inverse delete-range", () => {
    const op = opAddRange(["a", 1], ["c", "d"]);
    const inverseOp = inverse(op);
    expect(inverseOp).toStrictEqual(
      opDeleteRange(["a", { index: 1, length: 2 }])
    );
  });
  test("With set returns inverse set", () => {
    const op = opSetEnriched(["a", "b"], "c", "d");
    const inverseOp = inverse(op);
    expect(inverseOp).toStrictEqual(opSetEnriched(["a", "b"], "d", "c"));
  });
  test("With delete returns inverse add", () => {
    const op = opDeleteEnriched(["a", "b"], "X");
    const inverseOp = inverse(op);
    expect(inverseOp).toStrictEqual(opAdd(["a", "b"], "X"));
  });
  test("With delete-range returns inverse add", () => {
    const op = opDeleteRangeEnriched(
      ["a", { index: 1, length: 2 }],
      ["X", "Y"]
    );
    const inverseOp = inverse(op);
    expect(inverseOp).toStrictEqual(opAdd(["a", 1], ["X", "Y"]));
  });
  test("With swap returns inverse swap", () => {
    const op = opSwap([
      "a",
      [
        { index: 1, length: 2 },
        { index: 3, length: 1 },
      ],
    ]);
    const inverseOp = inverse(op);

    const expectedOp = opSwap([
      "a",
      [
        { index: 1, length: 1 },
        { index: 2, length: 2 },
      ],
    ]);
    expect(inverseOp).toStrictEqual(expectedOp);
  });
});

describe("canMergeOp", () => {
  test("With no last operations returns false", () => {
    const history = [];
    const transaction = -1;
    const operation = opSet(["a"], 0, 1);
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(false);
  });
  test("With last operation not being set returns false", () => {
    const history = [opAdd(["a", "value"], "b", 0)];
    const transaction = 0;
    const operation = opSet(["a"], 0, 1);
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(false);
  });
  test("With last operation path not equal returns false", () => {
    const history = [opSet(["b"], 1, 0)];
    const transaction = 0;
    const operation = opSet(["a"], 0, 1);
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(false);
  });
  test("With two operations returns false", () => {
    const history = [opSet(["b"], 1, 0)];
    const transaction = 0;
    const operation = [opSet(["a"], 0, 1), opSet(["b"], 0, 1)];
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(false);
  });
  test("With set on same path and single op returns true", () => {
    const history = [opSet(["b", "c"], 1, 0)];
    const transaction = 0;
    const operation = opSet(["b", "c"], 2, 0);
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(true);
  });
  test("With set on same path in array and single op returns true", () => {
    const history = [opSet(["b", "c"], 1, 0)];
    const transaction = 0;
    const operation = [opSet(["b", "c"], 2, 0)];
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(true);
  });
});

describe("mergeLastOp", () => {
  test("With last operation merge-able, overwrites value", () => {
    const history = [opSet(["a", "b"], 1, 0)];
    const operation = opSet(["a", "b"], 2, 0);
    const mergedHistory = mergeLastOp(history, operation);
    expect(mergedHistory).toStrictEqual([opSet(["a", "b"], 2, 0)]);
  });
});

describe("discardFutureOps", () => {
  test("With history removes operations from the future", () => {
    const history = [
      opSet(["a", "b"], 1, 0),
      opSet(["a", "b"], 2, 1),
      opSet(["a", "b"], 3, 2),
    ];
    const newHistory = discardFutureOps(history, 1);
    expect(newHistory).toStrictEqual([history[0]]);
  });
});

describe("addOp", () => {
  test("With history adds single operation with transaction", () => {
    const history = [opSet(["a"], 1, 0)];
    const operation = opSet(["b"], 2);
    const transaction = 5;
    const newHistory = addOp(history, transaction, operation);
    expect(newHistory).toStrictEqual([
      opSet(["a"], 1, 0),
      opSet(["b"], 2, 5),
    ]);
  });
  test("With history adds multiple operations with transaction", () => {
    const history = [opSet(["a"], 1, 0)];
    const operation = [opSet(["b"], 2, 0), opSet(["c"], 3, 0)];
    const transaction = 5;
    const newHistory = addOp(history, transaction, operation);
    expect(newHistory).toStrictEqual([
      opSet(["a"], 1, 0),
      opSet(["b"], 2, 5),
      opSet(["c"], 3, 5),
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
  test("With add nested array inserts into array", () => {
    const input = [{ a: [1, 2] }, { b: [3, 4] }];
    const clone = applyOp(input, opAdd([0, "a", 1], 5));
    expect(clone).toStrictEqual([{ a: [1, 5, 2] }, { b: [3, 4] }]);
  });
  test("With add-range to array inserts flat", () => {
    const input = [1, 2, 3];
    const clone = applyOp(input, opAddRange([1], [4, 5]));
    expect(clone).toStrictEqual([1, 4, 5, 2, 3]);
  });
  test("With set on object sets property", () => {
    const input = { a: 1, b: 2 };
    const clone = applyOp(input, opSet(["a"], 3));
    expect(clone).toStrictEqual({ a: 3, b: 2 });
  });
  test("With set on nested object sets property", () => {
    const input = { a: { b: { c: 1 } }, b: 2 };
    const clone = applyOp(input, opSet(["a", "b", "c"], 3));
    expect(clone).toStrictEqual({ a: { b: { c: 3 } }, b: 2 });
  });
  test("With set on array changes single value", () => {
    const input = [1, 2, 3];
    const clone = applyOp(input, opSet([1], 4));
    expect(clone).toStrictEqual([1, 4, 3]);
  });
  test("With set on nested array changes single value", () => {
    const input = [{ a: 1 }, { b: 2 }, { c: 3 }];
    const clone = applyOp(input, opSet([1, "b"], 4));
    expect(clone).toStrictEqual([{ a: 1 }, { b: 4 }, { c: 3 }]);
  });
  test("With delete on object deletes property", () => {
    const input = { a: 1, b: 2 };
    const clone = applyOp(input, opDelete(["a"]));
    expect(clone).toStrictEqual({ b: 2 });
  });
  test("With delete on nested object deletes property", () => {
    const input = { a: { b: { c: 1 } }, b: 2 };
    const clone = applyOp(input, opDelete(["a", "b", "c"]));
    expect(clone).toStrictEqual({ a: { b: {} }, b: 2 });
  });
  test("With delete on array removes single value", () => {
    const input = [1, 2, 3];
    const clone = applyOp(input, opDelete([1]));
    expect(clone).toStrictEqual([1, 3]);
  });
  test("With delete on nested array removes single value", () => {
    const input = [{ a: [1, 2] }, { b: [3, 4] }];
    const clone = applyOp(input, opDelete([0, "a", 1], 2));
    expect(clone).toStrictEqual([{ a: [1] }, { b: [3, 4] }]);
  });
  test("With delete-range from array removes multiple values", () => {
    const input = [1, 2, 3, 4, 5];
    const clone = applyOp(
      input,
      opDeleteRange([{ index: 1, length: 2 }])
    );
    expect(clone).toStrictEqual([1, 4, 5]);
  });
  test("With swap of two single value", () => {
    const input = [1, 2, 3, 4, 5];
    const clone = applyOp(
      input,
      opSwap([
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
      opSwap([
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
      opSwap([
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
      opSet(["a"], 3),
      opSet(["b"], 4),
    ]);
    expect(clone).toStrictEqual({ a: 3, b: 4 });
  });
  test("With succeeding adds adds one after another", () => {
    const input = [1, 2];
    const clone = applyOp(input, [opAdd([2], 3), opAdd([3], 4)]);
    expect(clone).toStrictEqual([1, 2, 3, 4]);
  });
});
