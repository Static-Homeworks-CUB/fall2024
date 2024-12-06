import { init } from "z3-solver";
import { SymbolicExecutor, SymState, PathCondition } from "./executor";
import { SymVarArith } from "./expressions";
import { parseTact } from "./parser";

export type SymbolicExecutionSuccess = {
  kind: "success";
  pathConditions: string[];
  inputs: Record<string, string>;
  returnValue: string | null;
};

export type SymbolicExecutionFailure = {
  kind: "failure";
  pathConditions: string[];
  message: string;
};

type SymbolicExecutionResult =
  | SymbolicExecutionSuccess
  | SymbolicExecutionFailure;

export async function runSymbolicExecution(
  codeString: string,
): Promise<SymbolicExecutionResult[]> {
  const { Context } = await init();
  const ctx = Context("main");

  const executor = new SymbolicExecutor(ctx);
  const state = new SymState();
  const initialPC = new PathCondition();

  // Define symbolic variables. These are used as function arguments.
  const x = new SymVarArith("x");
  state.setVar("x", x);

  const ast = parseTact(codeString);
  if (!ast) throw new Error(`Cannot parse Tact`);

  const allResults: SymbolicExecutionResult[] = [];
  for (const f of ast.functions) {
    // Execute each function symbolically
    if (f.kind !== "function_def") continue;

    const results = await executor.executeFunction(f, state, initialPC);

    // Process the results
    for (const result of results) {
      // Collect Z3 formulas (path conditions)
      const pathConditions = result.pathCondition.constraints.map(
        (constraint) => constraint.toZ3Expr(ctx).toString(),
      );

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

      const checkResult = await solver.check();
      if (checkResult === "sat") {
        const model = solver.model();
        const evaluatedInputs: Record<string, string> = {};
        for (const [name, value] of inputs.entries()) {
          evaluatedInputs[name] = value.toString();
        }
        let evaluatedReturnValue = null;
        if (returnValue) {
          evaluatedReturnValue = model.eval(returnValue, true).toString();
        }
        allResults.push({
          kind: "success",
          pathConditions,
          inputs: evaluatedInputs,
          returnValue: evaluatedReturnValue,
        });
      } else {
        allResults.push({
          kind: "failure",
          pathConditions,
          message: `Solver result is ${checkResult}, no model available.`,
        });
      }
    }
  }

  return allResults;
}
