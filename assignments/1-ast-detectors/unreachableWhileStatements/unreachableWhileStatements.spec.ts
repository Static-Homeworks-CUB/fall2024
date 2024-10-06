import { Driver } from "@nowarp/misti/src/cli";
import path from "path";

describe("UnreachableWhileStatements detector tests", () => {
  it("should detect an issue in the problematic contract", async () => {
    const contractPath = path.resolve(
      __dirname,
      "test",
      "unreachableWhileContract.tact",
    );

    // Create a driver instance that runs only the given custom detector
    const detectorPath =
      "assignments/1-ast-detectors/unreachableWhileStatements/unreachableWhileStatements.ts";
    const className = "UnreachableWhileStatements";
    const driver = await Driver.create(contractPath, {
      detectors: [`${detectorPath}:${className}`],
    });

    // Ensure whether the detector has been initialized correctly
    expect(driver.detectors.length).toBe(1);
    expect(driver.detectors[0].id).toBe(className);

    // Execute the driver
    // You could also get the complete output by running Misti this way:
    //   export DIR=assignments/1-ast-detectors/singleLetterIdentifier
    //   yarn misti --detectors $DIR/unreachableWhileStatements.ts:UnreachableWhileStatements $DIR/test/contract.tact
    const result = await driver.execute();
    expect(result.warningsFound).toBe(2);

    // Examine the errors output.
    expect(result.output!.includes("While statement is not reachable")).toBe(
      true,
    );
  });

  it("should not detect any issue in the correct contract", async () => {
    const contractPath = path.resolve(
      __dirname,
      "test",
      "correctContract.tact",
    );

    // Create a driver instance that runs only the given custom detector
    const detectorPath =
      "assignments/1-ast-detectors/unreachableWhileStatements/unreachableWhileStatements.ts";
    const className = "UnreachableWhileStatements";
    const driver = await Driver.create(contractPath, {
      detectors: [`${detectorPath}:${className}`],
    });

    // Ensure whether the detector has been initialized correctly
    expect(driver.detectors.length).toBe(1);
    expect(driver.detectors[0].id).toBe(className);

    // Execute the driver
    // You could also get the complete output by running Misti this way:
    //   export DIR=assignments/1-ast-detectors/singleLetterIdentifier
    //   yarn misti --detectors $DIR/unreachableWhileStatements.ts:UnreachableWhileStatements $DIR/test/contract.tact
    const result = await driver.execute();
    expect(result.warningsFound).toBe(0);
  });
});
