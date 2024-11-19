import { Driver } from "@nowarp/misti/src/cli";
import path from "path";
import fs from "fs/promises";

describe("UseDefinition tests", () => {
  it("should produce correct output for the sample contract", async () => {
    const contractPath = path.resolve(__dirname, "contract.tact");

    // Create a driver instance that runs only the given custom detector
    const detectorPath =
      "assignments/2-gen-kill-analyses/Use-Definition-Chains/useDefinitionChains.ts";
    const className = "useDefinitionChains";
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
    const expectedOutput = `// gen  = [let a: Int = 0;]
// kill = []
// in   = []
// out  = [let a: Int = 0;]
let a: Int = 0;

// gen  = [let b: Int = a + 1;]
// kill = []
// in   = [let a: Int = 0;]
// out  = [let b: Int = a + 1;, let a: Int = 0;]
let b: Int = a + 1;

// gen  = [a = b;]
// kill = [let a: Int = 0;]
// in   = [let b: Int = a + 1;, let a: Int = 0;]
// out  = [a = b;, let b: Int = a + 1;]
a = b;

// gen  = [let c: Int = a + 1;]
// kill = []
// in   = [a = b;, let b: Int = a + 1;]
// out  = [let c: Int = a + 1;, a = b;, let b: Int = a + 1;]
let c: Int = a + 1;

// gen  = [a = c;]
// kill = [let a: Int = 0;, a = b;]
// in   = [let c: Int = a + 1;, a = b;, let b: Int = a + 1;]
// out  = [a = c;, let c: Int = a + 1;, let b: Int = a + 1;]
a = c;

// gen  = []
// kill = []
// in   = [a = c;, let c: Int = a + 1;, let b: Int = a + 1;]
// out  = [a = c;, let c: Int = a + 1;, let b: Int = a + 1;]
return a;
`;
    expect(resultsContent.trim()).toBe(expectedOutput.trim());
  });
});
