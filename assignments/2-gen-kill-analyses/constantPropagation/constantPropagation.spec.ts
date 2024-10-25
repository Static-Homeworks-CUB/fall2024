import { Driver } from "@nowarp/misti/src/cli";
import path from "path";
import fs from "fs/promises";

describe("ConstantPropagation tests", () => {
  it("should produce correct output for the sample contract", async () => {
    const contractPath = path.resolve(__dirname, "contract.tact");

    // Create a driver instance that runs only the given custom detector
    const detectorPath =
      "assignments/2-gen-kill-analyses/constantPropagation/constantPropagation.ts";
    const className = "ConstantPropagation";
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
    const expectedOutput = `// in = {}
// out  = {a}
let a: Int = 0;

// in = {a}
// out  = {a, x}
let x: Int = a + 5;

// in = {a, x}
// out  = {a, x}
if (true)

// in = {a, x}
// out  = {a}
x = abs(x);

// in = {a, x}
// out  = {a, x}
x = x + 3;

// in = {}
// out  = {}
while (a < 10)

// in = {}
// out  = {}
let b: Int = a + 1;

// in = {}
// out  = {}
a = b;

// in = {}
// out  = {}
return a;

`;
    expect(resultsContent.trim()).toBe(expectedOutput.trim());
  });
});
