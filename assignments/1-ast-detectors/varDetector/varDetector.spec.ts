import { Driver } from "@nowarp/misti/src/cli";
import path from "path";

describe("varDetector tests", () => {
  it("should detect an issue in the sample contract", async () => {
    const contractPath = path.resolve(__dirname, "test", "contract.tact");

    const detectorPath =
      "assignments/1-ast-detectors/varDetector/varDetector.ts";
    const className = "VarDetector";
    const driver = await Driver.create(contractPath, {
      detectors: [`${detectorPath}:${className}`],
    });

    expect(driver.detectors.length).toBe(1);
    expect(driver.detectors[0].id).toBe(className);

    const result = await driver.execute();
    expect(result.warningsFound).toBe(1);

    expect(
      result.output!.includes("Local variable bar should have explicit type"),
    ).toBe(true);
  });
});
