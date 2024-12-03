import { Driver } from "@nowarp/misti/src/cli";
import path from "path";
import fs from "fs/promises";

const SECONDS = 1000;

describe("Definite Assignment tests", () => {
  it(
    "should produce correct output for the sample contract",
    async () => {
      const contractPath = path.resolve(__dirname, "contract.tact");

      // Create a driver instance that runs only the given custom detector
      const detectorPath =
        "assignments/2-gen-kill-analyses/definiteAssignment/definiteAssignment.ts";
      const className = "DefiniteAssignment";
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
      const expectedOutput = `// def = []
// use = []
// in = []
// out = []
let a: Int = 0;

// def = []
// use = [a]
// in = [a]
// out = []
while (a < 10)

// def = []
// use = []
// in = []
// out = []
let b: Int = a + 1;

// def = [a]
// use = [b]
// in = []
// out = [a]
a = b;

// def = []
// use = [a]
// in = []
// out = []
return a;`;
      expect(resultsContent.trim()).toBe(expectedOutput.trim());
    },
    70 * SECONDS,
  );
});
