import { Driver } from "@nowarp/misti/src/cli";
import path from "path";
import fs from "fs/promises";

describe("Reaching Definitions tests", () => {
  it("should produce correct output for the sample contract", async () => {
    const contractPath = path.resolve(__dirname, "contract.tact");

    // Create a driver instance that runs only the given custom detector
    const detectorPath =
      "assignments/2-gen-kill-analyses/reachingDefinitions/reachingDefinitions.ts";
    const className = "ReachingDefinitions";
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
    const expectedOutput = `{"id":1655,"kind":"statement_let","name":{"id":1652,"kind":"id","text":"x","loc":{}},"type":{"id":1653,"kind":"type_id","text":"Int","loc":{}},"expression":{"id":1654,"kind":"number","base":10,"value":2,"loc":{}},"loc":{}}
{}


{"id":1659,"kind":"statement_let","name":{"id":1656,"kind":"id","text":"y","loc":{}},"type":{"id":1657,"kind":"type_id","text":"Int","loc":{}},"expression":{"id":1658,"kind":"number","base":10,"value":5,"loc":{}},"loc":{}}
{"x":["2"]}


{"id":1670,"kind":"statement_condition","condition":{"id":1660,"kind":"boolean","value":true,"loc":{}},"trueStatements":[{"id":1664,"kind":"statement_let","name":{"id":1661,"kind":"id","text":"z","loc":{}},"type":{"id":1662,"kind":"type_id","text":"Int","loc":{}},"expression":{"id":1663,"kind":"number","base":10,"value":7,"loc":{}},"loc":{}}],"falseStatements":[{"id":1669,"kind":"statement_let","name":{"id":1665,"kind":"id","text":"z","loc":{}},"type":{"id":1666,"kind":"type_id","text":"Int","loc":{}},"expression":{"id":1668,"kind":"op_unary","op":"-","operand":{"id":1667,"kind":"number","base":10,"value":7,"loc":{}},"loc":{}},"loc":{}}],"elseif":null,"loc":{}}
{"y":["5"],"x":["2"]}


{"id":1664,"kind":"statement_let","name":{"id":1661,"kind":"id","text":"z","loc":{}},"type":{"id":1662,"kind":"type_id","text":"Int","loc":{}},"expression":{"id":1663,"kind":"number","base":10,"value":7,"loc":{}},"loc":{}}
{"y":["5"],"x":["2"]}


{"id":1669,"kind":"statement_let","name":{"id":1665,"kind":"id","text":"z","loc":{}},"type":{"id":1666,"kind":"type_id","text":"Int","loc":{}},"expression":{"id":1668,"kind":"op_unary","op":"-","operand":{"id":1667,"kind":"number","base":10,"value":7,"loc":{}},"loc":{}},"loc":{}}
{"y":["5"],"x":["2"]}


{"id":1684,"kind":"statement_while","condition":{"id":1673,"kind":"op_binary","op":">","left":{"id":1671,"kind":"id","text":"y","loc":{}},"right":{"id":1672,"kind":"number","base":10,"value":0,"loc":{}},"loc":{}},"statements":[{"id":1677,"kind":"statement_let","name":{"id":1674,"kind":"id","text":"difference","loc":{}},"type":{"id":1675,"kind":"type_id","text":"Int","loc":{}},"expression":{"id":1676,"kind":"id","text":"y","loc":{}},"loc":{}},{"id":1680,"kind":"statement_assign","path":{"id":1678,"kind":"id","text":"x","loc":{}},"expression":{"id":1679,"kind":"id","text":"y","loc":{}},"loc":{}},{"id":1683,"kind":"statement_assign","path":{"id":1681,"kind":"id","text":"y","loc":{}},"expression":{"id":1682,"kind":"number","base":10,"value":9,"loc":{}},"loc":{}}],"loc":{}}
{"z":[" - 7","7"],"y":["5"],"x":["2"],"difference":["y"]}


{"id":1677,"kind":"statement_let","name":{"id":1674,"kind":"id","text":"difference","loc":{}},"type":{"id":1675,"kind":"type_id","text":"Int","loc":{}},"expression":{"id":1676,"kind":"id","text":"y","loc":{}},"loc":{}}
{"z":[" - 7","7"],"y":["5"],"x":["2"],"difference":["y"]}


{"id":1680,"kind":"statement_assign","path":{"id":1678,"kind":"id","text":"x","loc":{}},"expression":{"id":1679,"kind":"id","text":"y","loc":{}},"loc":{}}
{"difference":["y"],"z":[" - 7","7"],"y":["5"],"x":["2"]}


{"id":1683,"kind":"statement_assign","path":{"id":1681,"kind":"id","text":"y","loc":{}},"expression":{"id":1682,"kind":"number","base":10,"value":9,"loc":{}},"loc":{}}
{"difference":["y"],"z":[" - 7","7"],"y":["5"]}


{"id":1686,"kind":"statement_return","expression":{"id":1685,"kind":"id","text":"x","loc":{}},"loc":{}}
{"z":[" - 7","7"],"y":["5"],"x":["2"],"difference":["y"]}

`;
    expect(resultsContent.trim()).toBe(expectedOutput.trim());
  });
});
