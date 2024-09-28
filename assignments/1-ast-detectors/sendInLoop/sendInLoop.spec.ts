import { Driver } from "@nowarp/misti/src/cli";
import path from "path";

describe("SendInLoop detector tests", () => {
  it("should detect an issue in the sample contract", async () => {
    const contractPath = path.resolve(__dirname, "test", "contract.tact");

    // Create a driver instance that runs only the given custom detector
    const detectorPath = "assignments/1-ast-detectors/sendInLoop/sendInLoop.ts";
    const className = "SendInLoop";
    const driver = await Driver.create(contractPath, {
      detectors: [`${detectorPath}:${className}`],
    });

    // Ensure whether the detector has been initialized correctly
    expect(driver.detectors.length).toBe(1);
    expect(driver.detectors[0].id).toBe(className);

    // Execute the driver
    // You could also get the complete output by running Misti this way:
    //   export DIR=assignments/1-ast-detectors/sendInLoop
    //   yarn misti --detectors $DIR/sendInLoop.ts:sendInLoop $DIR:/test/contract.tact
    const result = await driver.execute();
    expect(result.warningsFound).toBe(5);

    // Examine the errors output.
    expect(result.output!.includes("contract.tact:5:13")).toBe(true);
    expect(result.output!.includes("contract.tact:15:13")).toBe(true);
    expect(result.output!.includes("contract.tact:25:13")).toBe(true);
    expect(result.output!.includes("contract.tact:36:13")).toBe(true);
    expect(result.output!.includes("contract.tact:47:17")).toBe(true);
  });
});
