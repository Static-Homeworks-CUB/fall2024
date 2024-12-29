import { Driver } from "@nowarp/misti/src/cli";
import path from "path";
import fs from "fs/promises";

describe("CopyPropagation tests", () => {
  it("should produce correct output for the sample contract", async () => {
    const contractPath = path.resolve(__dirname, "contract.tact");

    // Create a driver instance that runs only the given custom detector
    const detectorPath =
      "assignments/2-gen-kill-analyses/copyPropagation/copyPropagation.ts";
    const className = "CopyPropagation";
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
    const expectedOutput = `// gen  = [a]
// kill = [a]
// in   = []
// out  = [a]
let a: Int = 0;

// gen  = []
// kill = []
// in   = [a,b]
// out  = [a,b]
while (a < 10)

// gen  = [b]
// kill = [b]
// in   = [a,b]
// out  = [b,a]
let b: Int = a + 1;

// gen  = []
// kill = [a]
// in   = [b,a]
// out  = [b]
a = b;

// gen  = []
// kill = []
// in   = [a,b]
// out  = [a,b]
return a; `;
    // no cleanup of variables gone out of scope ==> b at the return point
    // better comments inside the contract file
    expect(resultsContent.trim()).toBe(expectedOutput.trim());
  });
});
