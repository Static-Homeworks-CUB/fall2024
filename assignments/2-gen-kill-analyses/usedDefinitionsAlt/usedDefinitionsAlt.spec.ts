import path from "path";
import fs from "fs/promises";

import { Driver } from "@nowarp/misti/src/cli";

describe("UsedDefinitionsAlt tests", () => {
  it("should produce correct output for the sample contract", async () => {
    const contractPath = path.resolve(__dirname, "contract.tact");

    // Create a driver instance that runs only the given custom detector
    const detectorPath =
      "assignments/2-gen-kill-analyses/usedDefinitionsAlt/usedDefinitionsAlt.ts";
    const className = "UsedDefinitionsAlt";
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
    const expectedOutput = `let a: Int = 0; (L:002)
// gen  = [let a: Int = 0; (L:002)]
// kill = [a = 24; (L:004), a = a + 5; (L:007), a = 6; (L:010)]
// in   = [let a: Int = 0; (L:002)]
// out  = []
// result = []
while (a < 10) (L:003)
// gen  = []
// kill = []
// in   = [let a: Int = 0; (L:002), let c: Int = a + b; (L:013), b = 10; (L:008), a = a + 5; (L:007), b = b + 3 (L:011), a = 6; (L:010)]
// out  = [let a: Int = 0; (L:002), let c: Int = a + b; (L:013), b = 10; (L:008), a = a + 5; (L:007), b = b + 3 (L:011), a = 6; (L:010)]
// result = [let a: Int = 0; (L:002), a = a + 5; (L:007), a = 6; (L:010)]
a = 24; (L:004)
// gen  = [a = 24; (L:004)]
// kill = [let a: Int = 0; (L:002), a = a + 5; (L:007), a = 6; (L:010)]
// in   = [a = 24; (L:004), let c: Int = a + b; (L:013), b = 10; (L:008), b = b + 3 (L:011)]
// out  = [let a: Int = 0; (L:002), let c: Int = a + b; (L:013), b = 10; (L:008), a = a + 5; (L:007), b = b + 3 (L:011), a = 6; (L:010)]
// result = []
let b: Int = a + 1; (L:005)
// gen  = [let b: Int = a + 1; (L:005)]
// kill = [b = 10; (L:008), b = b + 3 (L:011)]
// in   = [let b: Int = a + 1; (L:005), a = 24; (L:004), let c: Int = a + b; (L:013)]
// out  = [a = 24; (L:004), let c: Int = a + b; (L:013), b = 10; (L:008), b = b + 3 (L:011)]
// result = [a = 24; (L:004)]
if (b > 0) (L:006)
// gen  = []
// kill = []
// in   = [let b: Int = a + 1; (L:005), a = 24; (L:004), let c: Int = a + b; (L:013)]
// out  = [let b: Int = a + 1; (L:005), a = 24; (L:004), let c: Int = a + b; (L:013)]
// result = [let b: Int = a + 1; (L:005)]
a = a + 5; (L:007)
// gen  = [a = a + 5; (L:007)]
// kill = [let a: Int = 0; (L:002), a = 24; (L:004), a = 6; (L:010)]
// in   = [a = a + 5; (L:007), let b: Int = a + 1; (L:005), let c: Int = a + b; (L:013)]
// out  = [let b: Int = a + 1; (L:005), a = 24; (L:004), let c: Int = a + b; (L:013)]
// result = [a = 24; (L:004)]
b = 10; (L:008)
// gen  = [b = 10; (L:008)]
// kill = [let b: Int = a + 1; (L:005), b = b + 3 (L:011)]
// in   = [b = 10; (L:008), a = a + 5; (L:007), let c: Int = a + b; (L:013)]
// out  = [a = a + 5; (L:007), let b: Int = a + 1; (L:005), let c: Int = a + b; (L:013)]
// result = []
a = 6; (L:010)
// gen  = [a = 6; (L:010)]
// kill = [let a: Int = 0; (L:002), a = 24; (L:004), a = a + 5; (L:007)]
// in   = [a = 6; (L:010), let b: Int = a + 1; (L:005), let c: Int = a + b; (L:013)]
// out  = [let b: Int = a + 1; (L:005), a = 24; (L:004), let c: Int = a + b; (L:013)]
// result = []
b = b + 3; (L:011)
// gen  = [b = b + 3 (L:011)]
// kill = [let b: Int = a + 1; (L:005), b = 10; (L:008)]
// in   = [b = b + 3 (L:011), a = 6; (L:010), let c: Int = a + b; (L:013)]
// out  = [a = 6; (L:010), let b: Int = a + 1; (L:005), let c: Int = a + b; (L:013)]
// result = [let b: Int = a + 1; (L:005)]
let c: Int = a + b; (L:013)
// gen  = [let c: Int = a + b; (L:013)]
// kill = []
// in   = [let c: Int = a + b; (L:013), b = 10; (L:008), a = a + 5; (L:007), b = b + 3 (L:011), a = 6; (L:010)]
// out  = [b = 10; (L:008), a = a + 5; (L:007), let c: Int = a + b; (L:013), b = b + 3 (L:011), a = 6; (L:010)]
// result = [a = a + 5; (L:007), a = 6; (L:010), b = 10; (L:008), b = b + 3 (L:011)]
return a; (L:015)
// gen  = []
// kill = []
// in   = [let a: Int = 0; (L:002), let c: Int = a + b; (L:013), b = 10; (L:008), a = a + 5; (L:007), b = b + 3 (L:011), a = 6; (L:010)]
// out  = [let a: Int = 0; (L:002), let c: Int = a + b; (L:013), b = 10; (L:008), a = a + 5; (L:007), b = b + 3 (L:011), a = 6; (L:010)]
// result = [let a: Int = 0; (L:002), a = a + 5; (L:007), a = 6; (L:010)]
`;
    expect(resultsContent.trim()).toBe(expectedOutput.trim());
  });
});
