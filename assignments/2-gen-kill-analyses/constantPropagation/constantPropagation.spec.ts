import { Driver } from "@nowarp/misti/src/cli";
import path from "path";
import fs from "fs/promises";

describe("LiveVariables tests", () => {
  it("should produce correct output for the sample contract", async () => {
    const contractPath = path.resolve(__dirname, "contract.tact");

    // Create a driver instance that runs only the given custom detector
    const detectorPath =
      "assignments/2-gen-kill-analyses/liveVariables/liveVariables.ts";
    const className = "LiveVariables";
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
    const expectedOutput = `// gen  = []
// kill = [a]
// in   = []
// out  = [a]
let a: Int = 0;

// gen  = [a]
// kill = []
// in   = [a]
// out  = [a]
while (a < 10)

// gen  = [a]
// kill = [b]
// in   = [a]
// out  = [b]
let b: Int = a + 1;

// gen  = [b]
// kill = [a]
// in   = [b]
// out  = [a]
a = b;

// gen  = [a]
// kill = []
// in   = [a]
// out  = []
return a; `;
    expect(resultsContent.trim()).toBe(expectedOutput.trim());
  });
});
