import { OpType } from "./optype.js";

const type = new OpType();

describe("apply", () => {
  test("With none returns original object", () => {
    const input = { a: 1, b: 2 };
    const clone = type.apply(input);
    expect(clone).toStrictEqual(input);
  });
  test("With add to object adds property", () => {
    const input = { a: 1, b: 2 };
    const clone = type.apply(input, type.insertOp(["c"], 3));
    expect(clone).toStrictEqual({ a: 1, b: 2, c: 3 });
  });
  test("With add to nested object adds property", () => {
    const input = { a: { b: { c: 1 } }, b: 2 };
    const clone = type.apply(input, type.insertOp(["a", "b", "d"], 3));
    expect(clone).toStrictEqual({ a: { b: { c: 1, d: 3 } }, b: 2 });
  });
  test("With add to array inserts into array", () => {
    const input = [1, 2, 3];
    const clone = type.apply(input, type.insertOp([1], 4));
    expect(clone).toStrictEqual([1, 4, 2, 3]);
  });
  test("With add to nested array inserts into array", () => {
    const input = [{ a: [1, 2] }, { b: [3, 4] }];
    const clone = type.apply(input, type.insertOp([0, "a", 1], 5));
    expect(clone).toStrictEqual([{ a: [1, 5, 2] }, { b: [3, 4] }]);
  });
  test("With add-range to array inserts flat", () => {
    const input = [1, 2, 3];
    const clone = type.apply(input, type.insertRangeOp([1], [4, 5]));
    expect(clone).toStrictEqual([1, 4, 5, 2, 3]);
  });
  test("With replace on object replaces property", () => {
    const input = { a: 1, b: 2 };
    const clone = type.apply(input, type.replaceOp(["a"], 3));
    expect(clone).toStrictEqual({ a: 3, b: 2 });
  });
  test("With replace on array changes single value", () => {
    const input = [1, 2, 3];
    const clone = type.apply(input, type.replaceOp([1], 4));
    expect(clone).toStrictEqual([1, 4, 3]);
  });
  test("With remove on object deletes property", () => {
    const input = { a: 1, b: 2 };
    const clone = type.apply(input, type.removeOp(["a"]));
    expect(clone).toStrictEqual({ b: 2 });
  });
  test("With remove on array removes single value", () => {
    const input = [1, 2, 3];
    const clone = type.apply(input, type.removeOp([1]));
    expect(clone).toStrictEqual([1, 3]);
  });
  test("With remove-range from array removes multiple values", () => {
    const input = [1, 2, 3, 4, 5];
    const clone = type.apply(
      input,
      type.removeRangeOp([{ index: 1, length: 2 }])
    );
    expect(clone).toStrictEqual([1, 4, 5]);
  });
  test("With multiple operations applies after each other", () => {
    const input = { a: 1, b: 2 };
    const clone = type.apply(input, [
      type.replaceOp(["a"], 3),
      type.replaceOp(["b"], 4),
    ]);
    expect(clone).toStrictEqual({ a: 3, b: 4 });
  });
  test("With succeeding adds adds one after another", () => {
    const input = [1, 2];
    const clone = type.apply(input, [
      type.insertOp([2], 3),
      type.insertOp([3], 4),
    ]);
    expect(clone).toStrictEqual([1, 2, 3, 4]);
  });
});

describe("invertWithDoc", () => {
  test("With add returns inverse remove", () => {
    const op = type.insertOp(["a", "b"], "d");
    const opInverted = type.invertWithDoc(op, {});
    expect(opInverted).toStrictEqual(type.removeOp(["a", "b"]));
  });
  test("With add-range returns inverse remove-range", () => {
    const op = type.insertRangeOp(["a", 1], ["c", "d"]);
    const opInverted = type.invertWithDoc(op, {});
    expect(opInverted).toStrictEqual(
      type.removeRangeOp(["a", { index: 1, length: 2 }])
    );
  });
  test("With replace returns inverse replace", () => {
    const doc = { a: { b: "c" } };
    const op = type.replaceOp(["a", "b"], "d", 3);
    const opInverted = type.invertWithDoc(op, doc);
    expect(opInverted).toStrictEqual(type.replaceOp(["a", "b"], "c", 3));
  });
  test("With remove returns inverse add", () => {
    const doc = { a: { b: "X" } };
    const op = type.removeOp(["a", "b"], 3);
    const inverseOp = type.invertWithDoc(op, doc);
    expect(inverseOp).toStrictEqual(type.insertOp(["a", "b"], "X", 3));
  });
  test("With remove-range returns inverse add", () => {
    const doc = { a: [1, 2, 3, 4] };
    const op = type.removeRangeOp(["a", { index: 1, length: 2 }], 3);
    const inverseOp = type.invertWithDoc(op, doc);
    expect(inverseOp).toStrictEqual(type.insertRangeOp(["a", 1], [2, 3], 3));
  });
});

describe("compose", () => {
  test("With two single operations returns concatenated", () => {
    const op1 = type.insertOp(["a"], 0, 0);
    const op2 = type.replaceOp(["a"], 1, 1);
    const op3 = type.compose(op1, op2);
    expect(op3).toStrictEqual([op1, op2]);
  });
  test("With two array operations returns concatenated", () => {
    const op1 = type.insertOp(["a"], 0, 0);
    const op2 = type.replaceOp(["a"], 1, 1);
    const op3 = type.compose([op1], [op2]);
    expect(op3).toStrictEqual([op1, op2]);
  });
});

describe("composeSimilar", () => {
  test("With last operation not being replace returns false", () => {
    const op1 = type.insertOp(["a"], 0, 0);
    const op2 = type.replaceOp(["a"], 1, 1);
    const op3 = type.composeSimilar(op1, op2);
    expect(op3).toBe(null);
  });
  test("With last operation path not equal returns false", () => {
    const op1 = type.insertOp(["a"], 0, 0);
    const op2 = type.insertOp(["c"], 1, 1);
    const op3 = type.composeSimilar(op1, op2);
    expect(op3).toBe(null);
  });
  test("With two operations returns false", () => {
    const op1 = [type.insertOp(["a"], 0, 0), type.insertOp(["a"], 0, 0)];
    const op2 = type.insertOp(["a"], 1, 1);
    const op3 = type.composeSimilar(op1, op2);
    expect(op3).toBe(null);
  });
  test("With replace on same path and single op returns true", () => {
    const op1 = type.insertOp(["a", "b"], 0, 0);
    const op2 = type.insertOp(["a", "b"], 1, 1);
    const op3 = type.composeSimilar(op1, op2);
    expect(op3).toBe(null);
  });
});
