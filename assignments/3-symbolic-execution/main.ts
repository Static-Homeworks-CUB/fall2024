import { runSymbolicExecution } from "./driver";

// Use the following command from the project root to execute it:
// ./node_modules/.bin/ts-node assignments/3-symbolic-execution/main.ts

(async () => {
  const codeString = `fun test(x: Int): Int {
    if (x >= 0) {
      return x;
    } else {
      return -x;
    }
  }`;

  try {
    const results = await runSymbolicExecution(codeString);
    results.forEach((result, index) => {
      console.log(`\nResult ${index + 1}:`);
      console.log("Path Conditions:");
      result.pathConditions.forEach((pc) => {
        console.log(`  ${pc}`);
      });

      if (result.kind === "success") {
        console.log("Concrete Inputs:");
        for (const [name, value] of Object.entries(result.inputs)) {
          console.log(`  ${name} = ${value}`);
        }
        if (result.returnValue) {
          console.log(`Return Value: ${result.returnValue}`);
        }
      } else {
        console.log(result.message);
      }
      console.log("-----");
    });
  } catch (err) {
    console.error(err);
  }
})();
