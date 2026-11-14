import { expect } from "chai";

type BatchInputRow = {
  beneficiary: string;
  allocation: string;
  start: string;
  durationDays: string;
  cliffDays: string;
};

type BuildBatchPayload = (
  rows: readonly BatchInputRow[],
  decimals: number,
) => {
  beneficiaries: string[];
  allocations: bigint[];
  starts: bigint[];
  cliffs: bigint[];
  durations: bigint[];
  totalAllocation: bigint;
};

function loadHelper(): BuildBatchPayload {
  const validation = require("../src/features/vesting/batchValidation") as {
    buildBatchPayload: BuildBatchPayload;
  };
  return validation.buildBatchPayload;
}

const beneficiary = "0x0000000000000000000000000000000000000001";
const validRow: BatchInputRow = {
  beneficiary,
  allocation: "1.5",
  start: "2030-01-01T00:00:00.000Z",
  durationDays: "30",
  cliffDays: "7",
};

describe("create-batch payload validation", function () {
  it("builds the exact integer payload for a valid row", function () {
    const buildBatchPayload = loadHelper();

    expect(buildBatchPayload([validRow], 18)).to.deep.equal({
      beneficiaries: [beneficiary],
      allocations: [1_500_000_000_000_000_000n],
      starts: [1_893_456_000n],
      cliffs: [604_800n],
      durations: [2_592_000n],
      totalAllocation: 1_500_000_000_000_000_000n,
    });
  });

  it("rejects invalid rows before they become an on-chain payload", function () {
    const buildBatchPayload = loadHelper();
    const cases: Array<[string, readonly BatchInputRow[], RegExp]> = [
      ["an empty batch", [], /between 1 and 20/i],
      ["more than 20 rows", Array.from({ length: 21 }, () => validRow), /between 1 and 20/i],
      ["an invalid beneficiary", [{ ...validRow, beneficiary: "not-an-address" }], /beneficiary/i],
      ["the zero address", [{ ...validRow, beneficiary: "0x0000000000000000000000000000000000000000" }], /beneficiary/i],
      ["a zero allocation", [{ ...validRow, allocation: "0" }], /allocation/i],
      ["a zero row hidden by a positive total", [validRow, { ...validRow, allocation: "0" }], /allocation/i],
      ["epoch zero", [{ ...validRow, start: "1970-01-01T00:00:00.000Z" }], /start/i],
      ["a zero duration", [{ ...validRow, durationDays: "0" }], /duration/i],
      ["a tiny fractional day", [{ ...validRow, durationDays: "0.000001" }], /whole number/i],
      ["a negative cliff", [{ ...validRow, cliffDays: "-1" }], /whole number/i],
      ["a fractional cliff", [{ ...validRow, cliffDays: "0.5" }], /whole number/i],
      ["a cliff longer than duration", [{ ...validRow, durationDays: "1", cliffDays: "2" }], /cliff/i],
    ];

    for (const [name, rows, message] of cases) {
      expect(() => buildBatchPayload(rows, 18), name).to.throw(message);
    }
  });

  it("rejects integer values outside their ABI bounds", function () {
    const buildBatchPayload = loadHelper();
    const uint64Days = ((1n << 64n) / 86_400n).toString();
    const overUint64Days = (((1n << 64n) / 86_400n) + 1n).toString();
    const overUint256 = (1n << 256n).toString();

    expect(() => buildBatchPayload([{ ...validRow, durationDays: overUint64Days }], 18)).to.throw(/uint64/i);
    expect(() => buildBatchPayload([{ ...validRow, durationDays: uint64Days }], 18)).to.throw(/uint64/i);
    expect(() => buildBatchPayload([{ ...validRow, allocation: overUint256 }], 0)).to.throw(/uint256/i);
    expect(() => buildBatchPayload([
      { ...validRow, allocation: ((1n << 255n) + 1n).toString() },
      { ...validRow, allocation: (1n << 255n).toString() },
    ], 0)).to.throw(/total allocation.*uint256/i);
  });
});
