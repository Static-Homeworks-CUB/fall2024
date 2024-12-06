import { runSymbolicExecution, SymbolicExecutionSuccess } from "../driver";

describe("Symbolic Executor", () => {
  it("should execute code and return correct results", async () => {
    const codeString = `fun test(x: Int): Int {
      if (x >= 0) {
        return x;
      } else {
        return -x;
      }
    }`;

    const results = await runSymbolicExecution(codeString);
    expect(results.length).toBe(2);
    results.forEach((result) => {
      expect(result.kind).toBe("success");
      expect("inputs" in result).toBe(true);
      expect("returnValue" in result).toBe(true);
      expect("pathConditions" in result).toBe(true);
    });

    const successResults = results.filter(
      (r): r is SymbolicExecutionSuccess => r.kind === "success",
    );
    expect(successResults.length).toBe(2);

    // Check that all expected path conditions are present
    const expectedPathConditions = [["(>= x 0)"], ["(not (>= x 0))"]];
    expectedPathConditions.forEach((expectedPC) => {
      const found = successResults.some((result) => {
        return (
          JSON.stringify(result.pathConditions) === JSON.stringify(expectedPC)
        );
      });
      expect(found).toBe(true);
    });
  });
});
