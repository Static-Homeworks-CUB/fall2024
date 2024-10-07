import { Driver } from "@nowarp/misti/src/cli";
import path from "path";

describe("UnusedLoopVariable detector tests", () => {
  it("should detect unused loop variables in the sample contract", async () => {
    const contractPath = path.resolve(__dirname, "test", "contract.tact");

    // Create a driver instance that runs only the given custom detector
    const detectorPath =
      "assignments/1-ast-detectors/unusedLoopVariable/unusedLoopVariable.ts";
    const className = "UnusedLoopVariable";
    const driver = await Driver.create(contractPath, {
      detectors: [`${detectorPath}:${className}`],
    });

    // Ensure whether the detector has been initialized correctly
    expect(driver.detectors.length).toBe(1);
    expect(driver.detectors[0].id).toBe(className);

    // Execute the driver
    // You could also get the complete output by running Misti this way:
    //   export DIR=assignments/1-ast-detectors/unusedLoopVariable
    //   yarn misti --detectors $DIR/unusedLoopVariable.ts:UnusedLoopVariable $DIR:/test/contract.tact
    const result = await driver.execute();
    expect(result.warningsFound).toBe(4);

    // Examine the errors output.
    expect(
      result.output!.includes(
        "Loop variables 'simple' are not accessed in the loop body.",
      ),
    ).toBe(true);
    expect(
      result.output!.includes(
        "Loop variables 'simpleUntil' are not accessed in the loop body.",
      ),
    ).toBe(true);
    expect(
      result.output!.includes(
        "Loop variables 'nested' are not accessed in the loop body.",
      ),
    ).toBe(true);
    expect(
      result.output!.includes(
        "Loop variables 'v1 v2' are not accessed in the loop body.",
      ),
    ).toBe(true);
    expect(
      result.output!.includes(
        "Loop variables 'variableRead' are not accessed in the loop body.",
      ),
    ).toBe(false);
    expect(
      result.output!.includes(
        "Loop variables 'variableReassigned' are not accessed in the loop body.",
      ),
    ).toBe(false);
    expect(
      result.output!.includes(
        "Loop variables 'variableAugmentedOp' are not accessed in the loop body.",
      ),
    ).toBe(false);
    expect(
      result.output!.includes(
        "Loop variables 'variableUsedInNestedWhile' are not accessed in the loop body.",
      ),
    ).toBe(false);
  });
});
