import { Driver } from "@nowarp/misti/src/cli";
import path from "path";
import fs from "fs/promises";

describe("AvailableExpressions tests", () => {
  it("should produce correct output for the sample contract", async () => {
    const contractPath = path.resolve(__dirname, "contract.tact");

    // Create a driver instance that runs only the given custom detector
    const detectorPath =
      "assignments/2-gen-kill-analyses/availableExpressions/availableExpressions.ts";
    const className = "AvailableExpressions";
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
    const expectedOutput = `// gen  = [a,0]
// kill = []
// in   = []
// out  = [a,0]
let a: Int = 0;

// gen  = [c,2]
// kill = []
// in   = [a,0]
// out  = [c,2,a,0]
let c: Int = 2;

// gen  = [a < 10,a,10]
// kill = []
// in   = [c,2,a,0]
// out  = [a < 10,a,10,c,2,0]
while (a < 10)

// gen  = [b,a + 1,a,1]
// kill = []
// in   = [a < 10,a,10,c,2,0]
// out  = [b,a + 1,a,1,a < 10,10,c,2,0]
let b: Int = a + 1;

// gen  = [b % 2 == 0,b % 2,b,2,0]
// kill = []
// in   = [b,a + 1,a,1,a < 10,10,c,2,0]
// out  = [b % 2 == 0,b % 2,b,2,0,a + 1,a,1,a < 10,10,c]
if (b % 2 == 0)

// gen  = [d,b * c,b,c]
// kill = []
// in   = [b % 2 == 0,b % 2,b,2,0,a + 1,a,1,a < 10,10,c]
// out  = [d,b * c,b,c,b % 2 == 0,b % 2,2,0,a + 1,a,1,a < 10,10]
let d: Int = b * c;

// gen  = [a,d - 1,d,1]
// kill = [a,a + 1,a < 10]
// in   = [d,b * c,b,c,b % 2 == 0,b % 2,2,0,a + 1,a,1,a < 10,10]
// out  = [a,d - 1,d,1,b * c,b,c,b % 2 == 0,b % 2,2,0,10]
a = d - 1;

// gen  = [o,a + b,a,b]
// kill = []
// in   = [a,d - 1,d,1,b * c,b,c,b % 2 == 0,b % 2,2,0,10]
// out  = [o,a + b,a,b,d - 1,d,1,b * c,c,b % 2 == 0,b % 2,2,0,10]
let o: Int = a + b;

// gen  = [e,a * c,a,c]
// kill = []
// in   = [b % 2 == 0,b % 2,b,2,0,a + 1,a,1,a < 10,10,c]
// out  = [e,a * c,a,c,b % 2 == 0,b % 2,b,2,0,a + 1,1,a < 10,10]
let e: Int = a * c;

// gen  = [a,e + 2,e,2]
// kill = [a,a * c,a + 1,a < 10]
// in   = [e,a * c,a,c,b % 2 == 0,b % 2,b,2,0,a + 1,1,a < 10,10]
// out  = [a,e + 2,e,2,c,b % 2 == 0,b % 2,b,0,1,10]
a = e + 2;

// gen  = [o,a + b,a,b]
// kill = []
// in   = [a,e + 2,e,2,c,b % 2 == 0,b % 2,b,0,1,10]
// out  = [o,a + b,a,b,e + 2,e,2,c,b % 2 == 0,b % 2,0,1,10]
let o: Int = a + b;

// gen  = [f,a + c,a,c]
// kill = []
// in   = [a < 10,a,10,c,2,0]
// out  = [f,a + c,a,c,a < 10,10,2,0]
let f: Int = a + c;

// gen  = [f]
// kill = []
// in   = [f,a + c,a,c,a < 10,10,2,0]
// out  = [f,a + c,a,c,a < 10,10,2,0]
return f;`;
    expect(resultsContent.trim()).toBe(expectedOutput.trim());
  });
});
