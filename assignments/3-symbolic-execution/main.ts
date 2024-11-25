import { init } from "z3-solver";
import { SymbolicExecutor, SymState, PathCondition } from "./executor";
import { SymVarArith } from "./expressions";
import { parseTact } from "./parser";

(async () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { Context, em } = await init();
  const ctx = Context("main");

  const executor = new SymbolicExecutor(ctx);
  const state = new SymState();
  const initialPC = new PathCondition();

  // Define symbolic variables. These are used as function arguments.
  const x = new SymVarArith("x");
  state.setVar("x", x);

  //   const ast = parseTact(`fun test(x: Int): Int {
  //   if (x >= 0) {
  //     return x;
  //   } else {
  //     return -x;
  //   }
  // }`);
  const ast = parseTact(`fun test2(x: Int): Int {
  if ((x % 2 == 0)) {
    return x / 2;
  } else {
    return x * 3 + 1;
  }
}`);
  if (!ast) throw new Error(`Cannot parse Tact`)

  // Execute each function symbolically
  for (const f of ast.functions) {
    if (f.kind !== "function_def") continue;

    const results = await executor.executeFunction(f, state, initialPC);

    // Process the results
    for (const result of results) {
      // Print Z3 formulas (path conditions)
      console.log("\nPath Conditions:");
      result.pathCondition.constraints.forEach((constraint) => {
        console.log(`  ${constraint.toZ3Expr(ctx).toString()}`);
      });

      // Get concrete inputs that satisfy the path condition
      const inputs = await result.getConcreteInputs(ctx);

      // Get the return value
      const returnValueExpr = result.returnValue;
      const returnValue = returnValueExpr?.toZ3Expr(ctx);

      // Evaluate the return value using the model
      const solver = new ctx.Solver();
      const constraints = result.pathCondition.constraints.map((c) =>
        c.toZ3Expr(ctx),
      );
      constraints.forEach((constraint) => solver.add(constraint));

      if (returnValue) {
        solver.add(ctx.Eq(ctx.Const("return", returnValue.sort), returnValue));
      }

      // Call solver.check() before requesting the model
      const checkResult = await solver.check();

      if (checkResult === "sat") {
        const model = solver.model();

        console.log("Concrete Inputs:");
        for (const [name, value] of inputs.entries()) {
          console.log(`  ${name} = ${value.toString()}`);
        }

        if (returnValue) {
          const evaluatedReturnValue = model.eval(returnValue, true);
          console.log(`Return Value: ${evaluatedReturnValue.toString()}`);
        }
      } else {
        console.log(`Solver result is ${checkResult}, no model available.`);
      }

      console.log("-----");
    }
  }

  process.exit(0);
})();
