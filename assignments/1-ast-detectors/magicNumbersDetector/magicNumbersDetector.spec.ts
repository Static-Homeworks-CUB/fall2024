import { Driver } from "@nowarp/misti/src/cli";
import path from "path";

describe("MagicNumbersDetector tests", () => {
  it("should detect magic numbers in the code", async () => {
    const contractPath = path.resolve(__dirname, "test", "contract.tact");

    // Create a driver instance that runs only the MagicNumberDetector
    const detectorPath =
      "assignments/1-ast-detectors/magicNumbersDetector/magicNumbersDetector.ts";
    const className = "MagicNumbersDetector";
    const driver = await Driver.create(contractPath, {
      detectors: [`${detectorPath}:${className}`],
    });

    // Ensure the detector has been initialized correctly
    expect(driver.detectors.length).toBe(1);
    expect(driver.detectors[0].id).toBe(className);

    // Execute the driver
    const result = await driver.execute();
    // console.log(`Warnings found:\n${result.output!}`);

    // Check that the detector found the expected number of warnings
    expect(result.warningsFound).toBe(4);

    // Verify that the output includes the expected warning message
    expect(result.output!.includes("Magic number detected")).toBe(true);
  });
});
