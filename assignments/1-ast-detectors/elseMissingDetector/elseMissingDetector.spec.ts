import { Driver } from "@nowarp/misti/src/cli";
import path from "path";

describe("MissingElseDetector tests", () => {
  it("should detect missing else clauses in conditional statements", async () => {
    const contractPath = path.resolve(__dirname, "test", "contract.tact");

    // Create a driver instance that runs only the MissingElseDetector
    const detectorPath =
      "assignments/1-ast-detectors/elseMissingDetector/elseMissingDetector.ts";
    const className = "MissingElseDetector";
    const driver = await Driver.create(contractPath, {
      detectors: [`${detectorPath}:${className}`],
    });

    // Ensure the detector has been initialized correctly
    expect(driver.detectors.length).toBe(1);
    expect(driver.detectors[0].id).toBe(className);

    // Execute the driver
    const result = await driver.execute();
    console.log("Warnings found:");

    // Check that the detector found the expected number of warnings
    expect(result.warningsFound).toBe(1);

    //Verify that the output includes the expected warning message
    expect(
      result.output!.includes(
        "Conditional statement with 'else if' clauses should end with an 'else' clause",
      ),
    ).toBe(true);
  });
});
