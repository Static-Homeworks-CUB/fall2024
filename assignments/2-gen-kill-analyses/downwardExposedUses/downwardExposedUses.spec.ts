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
    const expectedOutput = `// lastdef = [a,1655]
// defkill = []
// in = []
// out = [a,1655]
let a: Int = 0;

// lastdef = []
// defkill = []
// in = [a,1655,a,1667,b,1664]
// out = [a,1655,a,1667,b,1664]
while (a < 10)

// lastdef = [b,1664]
// defkill = []
// in = [a,1655,a,1667,b,1664]
// out = [b,1664,a,1655,a,1667]
let b: Int = a + 1;

// lastdef = [a,1667]
// defkill = [a]
// in = [b,1664,a,1655,a,1667]
// out = [a,1667,b,1664]
a = b;

// lastdef = [a,1673]
// defkill = [a]
// in = [a,1655,a,1667,b,1664]
// out = [a,1673,b,1664]
a = 14 + 15;

// lastdef = []
// defkill = []
// in = [a,1673,b,1664]
// out = [a,1673,b,1664]
return a;

 `;
    expect(resultsContent.trim()).toBe(expectedOutput.trim());
  });
});
