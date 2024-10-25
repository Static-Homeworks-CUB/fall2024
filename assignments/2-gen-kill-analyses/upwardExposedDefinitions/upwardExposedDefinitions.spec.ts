import { Driver } from "@nowarp/misti/src/cli";
import path from "path";

describe("UpwardExposedDefinitions tests", () => {
  it("should produce correct output for the sample contract", async () => {
    const contractPath = path.resolve(__dirname, "contract.tact");

    // Create a driver instance that runs only the given custom detector
    const detectorPath =
      "assignments/2-gen-kill-analyses/upwardExposedDefinitions/upwardExposedDefinitions.ts";
    const className = "UpwardExposedDefinitions";
    const driver = await Driver.create(contractPath, {
      detectors: [`${detectorPath}:${className}`],
    });

    // Ensure whether the detector has been initialized correctly
    expect(driver.detectors.length).toBe(1);
    expect(driver.detectors[0].id).toBe(className);

    // Execute the driver
    await driver.execute();

    expect(true).toBe(true); // dummy
  });
});
