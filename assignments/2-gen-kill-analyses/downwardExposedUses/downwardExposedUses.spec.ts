import { Driver } from "@nowarp/misti/src/cli";
import path from "path";
import fs from "fs/promises";

describe("DownwardExposedUses tests", () => {
  it("should produce correct output for the sample contract", async () => {
    const contractPath = path.resolve(__dirname, "contract.tact");

    // Create a driver instance that runs only the given custom detector
    const detectorPath =
      "assignments/2-gen-kill-analyses/downwardExposedUses/downwardExposedUses.ts";
    const className = "DownwardExposedUses";
    const driver = await Driver.create(contractPath, {
      detectors: [`${detectorPath}:${className}`],
    });

    // Ensure whether the detector has been initialized correctly
    expect(driver.detectors.length).toBe(1);
    expect(driver.detectors[0].id).toBe(className);

    // Execute the driver
    await driver.execute();

    const resultsPath = path.resolve(__dirname, "result.txt");
    const resultsContent = await fs.readFile(resultsPath, "utf-8");
    const expectedOutput = `// use = [a,2,5]
// def = []
// in = []
// out = [a,2,5]
let a: Int = 0;

// use = []
// def = []
// in = [a,2,5,a,5,9,b,4,9]
// out = [a,2,5,a,5,9,b,4,9]
while (a < 10)

// use = [b,4,9]
// def = []
// in = [a,2,5,a,5,9,b,4,9]
// out = [b,4,9,a,2,5,a,5,9]
let b: Int = a + 1;

// use = [a,5,9]
// def = [a]
// in = [b,4,9,a,2,5,a,5,9]
// out = [a,5,9,b,4,9]
a = b;

// use = [a,7,5]
// def = [a]
// in = [a,2,5,a,5,9,b,4,9]
// out = [a,7,5,b,4,9]
a = 14 + 15;

// use = []
// def = []
// in = [a,7,5,b,4,9]
// out = [a,7,5,b,4,9]
return a;

 `;
    expect(resultsContent.trim()).toBe(expectedOutput.trim());
  });
});
