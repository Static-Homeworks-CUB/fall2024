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
    const expectedOutput = `==========================
======= ifElseTest =======
==========================

// in = {}
// out  = {a}
let a: Int = 0;

// in = {a}
// out  = {a, x}
let x: Int = a + 5;

// in = {a, x}
// out  = {a, x}
if (a > 5)

// in = {a, x}
// out  = {a}
x = abs(x);

// in = {a, x}
// out  = {a, x}
x = x + 3;

// in = {}
// out  = {}
return a;

=========================
======= whileTest =======
=========================

// in = {}
// out  = {a}
let a: Int = 0;

// in = {a}
// out  = {a, x}
let x: Int = a;

// in = {}
// out  = {}
while (a < 5)

// in = {}
// out  = {x}
x += 1;

// in = {}
// out  = {}
return a;

=========================
======= fieldTest =======
=========================

// in = {}
// out  = {field}
self.field = -5;

// in = {field}
// out  = {}
self.field = abs(self.field);

===========================
======= foreachTest =======
===========================

// in = {}
// out  = {}
let cells: map<Int, Int> = emptyMap();

// in = {}
// out  = {sum}
let sum: Int = 0;

// in = {}
// out  = {}
foreach (key, value in cells)

// in = {}
// out  = {}
sum += value;

// in = {}
// out  = {}
return sum;

`;
    expect(resultsContent.trim()).toBe(expectedOutput.trim());
  });
});
