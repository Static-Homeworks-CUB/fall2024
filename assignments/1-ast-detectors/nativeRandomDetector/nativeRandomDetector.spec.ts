import { Driver } from "@nowarp/misti/src/cli";
import path from "path";

describe("NativeRandom detector tests", () => {
  it("should detect an issue in the sample contract", async () => {
    const contractPath = path.resolve(__dirname, "test", "contract.tact");

    // Create a driver instance that runs only the given custom detector
    const detectorPath =
      "assignments/1-ast-detectors/nativeRandomDetector/nativeRandomDetector.ts";
    const className = "NativeRandomDetector";
    const driver = await Driver.create(contractPath, {
      detectors: [`${detectorPath}:${className}`],
    });

    // Ensure whether the detector has been initialized correctly
    expect(driver.detectors.length).toBe(1);
    expect(driver.detectors[0].id).toBe(className);

    // Execute the driver
    // You could also get the complete output by running Misti this way:
    //   export DIR=assignments/1-ast-detectors/singleLetterIdentifier
    //   yarn misti --detectors $DIR/singleLetterIdentifier.ts:SingleLetterIdentifier $DIR:/test/contract.tact
    const result = await driver.execute();
    expect(result.warningsFound).toBe(5);

    // Examine the errors output.
    expect(
      result.output!.includes(
        "Function nativeRandom requires prior random generator initialization. Consider using randomInt instead",
      ),
    ).toBe(true);
  });
});
