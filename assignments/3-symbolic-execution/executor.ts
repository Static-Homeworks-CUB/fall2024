import {
  AstCondition,
  AstExpression,
  AstFunctionDef,
  AstStatement,
  AstStatementAssign,
  AstStatementLet,
} from "@tact-lang/compiler/dist/grammar/ast";
import { Context, IntNum, RatNum } from "z3-solver";
import {
  SymExpr,
  SymArithExpr,
  SymBoolExpr,
  SymConstArith,
  SymConstBool,
  SymVarArith,
  SymArithOp,
  SymBoolOp,
  SymArithUnaryOp,
  SymBoolUnaryOp,
} from "./expressions";

/**
 * Executes the statements of a function symbolically.
 */
export class SymbolicExecutor {
  ctx: Context;

  constructor(ctx: Context) {
    this.ctx = ctx;
  }

  async executeFunction(
    funcDef: AstFunctionDef,
    initialState: SymState,
    initialPC: PathCondition,
  ): Promise<SymExecutionResult[]> {
    const results: SymExecutionResult[] = [];
    await this.executeStatements(
      funcDef.statements,
      initialState,
      initialPC,
      results,
    );
    return results;
  }

  /**
   * Executes a list of statements symbolically.
   *
   * @param statements Array of AST statements to execute
   * @param state Current symbolic state containing variable assignments
   * @param pc Path condition tracking constraints for this execution path
   * @param results Collection of execution results to append to
   */
  async executeStatements(
    statements: AstStatement[],
    state: SymState,
    pc: PathCondition,
    results: SymExecutionResult[],
  ) {
    for (const stmt of statements) {
      switch (stmt.kind) {
        case "statement_let":
          this.executeLetStatement(stmt, state);
          break;
        case "statement_assign":
          this.executeAssignStatement(stmt, state);
          break;
        case "statement_condition":
          await this.executeConditionStatement(stmt, state, pc, results);
          return; // Branching occurs
        case "statement_return":
          const returnValue = stmt.expression
            ? this.evaluateExpression(stmt.expression, state)
            : null;
          results.push(new SymExecutionResult(state, pc, returnValue));
          return; // Function execution ends
        default:
          // TODO: Handle other statemenets
          break;
      }
    }
  }

  executeLetStatement(stmt: AstStatementLet, state: SymState) {
    const value = this.evaluateExpression(stmt.expression, state);
    state.setVar(stmt.name.text, value);
  }

  executeAssignStatement(stmt: AstStatementAssign, state: SymState) {
    const value = this.evaluateExpression(stmt.expression, state);
    const varName = this.getVarNameFromExpression(stmt.path);
    if (varName) {
      state.setVar(varName, value);
    } else {
      // TODO Handle field access
    }
  }

  /**
   * Executes a condition statement symbolically.
   *
   * We will create two new paths: one for the "then" branch  and one for the
   * "else" branch.
   */
  async executeConditionStatement(
    stmt: AstCondition,
    state: SymState,
    pc: PathCondition,
    results: SymExecutionResult[],
  ): Promise<void> {
    const conditionExpr = this.evaluateExpression(stmt.condition, state);
    if (!(conditionExpr instanceof SymBoolExpr)) {
      throw new Error("Condition must be a boolean expression");
    }

    const thenState = state.clone();
    const thenPC = pc.clone();
    thenPC.addConstraint(conditionExpr);

    const thenSatisfiable = await thenPC.isSatisfiable(this.ctx);
    if (thenSatisfiable) {
      await this.executeStatements(
        stmt.trueStatements,
        thenState,
        thenPC,
        results,
      );
    }

    if (stmt.falseStatements) {
      const elseState = state.clone();
      const elsePC = pc.clone();
      const negatedCondition = new SymBoolUnaryOp("!", conditionExpr);
      elsePC.addConstraint(negatedCondition);

      const elseSatisfiable = await elsePC.isSatisfiable(this.ctx);
      if (elseSatisfiable) {
        await this.executeStatements(
          stmt.falseStatements,
          elseState,
          elsePC,
          results,
        );
      }
    }
  }

  /**
   * Creates a symbolic expression for the given concrete expression.
   */
  evaluateExpression(expr: AstExpression, state: SymState): SymExpr<any> {
    switch (expr.kind) {
      case "number":
        return new SymConstArith(BigInt(expr.value));
      case "boolean":
        return new SymConstBool(expr.value as boolean);
      case "id":
        return state.getVar(expr.text) || new SymVarArith(expr.text);
      case "op_binary":
        const left = this.evaluateExpression(expr.left, state);
        const right = this.evaluateExpression(expr.right, state);

        if (["+", "-", "*", "/", "%"].includes(expr.op)) {
          return new SymArithOp(
            expr.op,
            left as SymArithExpr,
            right as SymArithExpr,
          );
        } else if (
          ["==", "!=", ">", ">=", "<", "<=", "&&", "||"].includes(expr.op)
        ) {
          return new SymBoolOp(expr.op, left, right);
        } else {
          throw new Error(`Unsupported operator: ${expr.op}`);
        }
      case "op_unary":
        const operand = this.evaluateExpression(expr.operand, state);
        if (expr.op === "-") {
          return new SymArithUnaryOp(expr.op, operand as SymArithExpr);
        } else if (expr.op === "!") {
          return new SymBoolUnaryOp(expr.op, operand as SymBoolExpr);
        } else {
          throw new Error(`Unsupported unary operator: ${expr.op}`);
        }
      default:
        throw new Error(`Unsupported expression kind: ${expr.kind}`);
    }
  }

  getVarNameFromExpression(expr: AstExpression): string | null {
    if (expr.kind === "id") {
      return expr.text;
    }
    return null;
  }
}

/**
 * Represents the path condition during symbolic execution.
 *
 * The path condition is a set of constraints that must be satisfied for the
 * execution to be valid.
 */
export class PathCondition {
  constraints: SymBoolExpr[] = [];

  clone(): PathCondition {
    const pc = new PathCondition();
    pc.constraints = [...this.constraints];
    return pc;
  }

  addConstraint(expr: SymBoolExpr) {
    this.constraints.push(expr);
  }

  async isSatisfiable(ctx: Context): Promise<boolean> {
    const solver = new ctx.Solver();
    for (const constraint of this.constraints) {
      solver.add(constraint.toZ3Expr(ctx));
    }
    const result = await solver.check();
    return result === "sat";
  }

  async getModel(ctx: Context): Promise<Map<string, bigint | boolean>> {
    const solver = new ctx.Solver();

    for (const constraint of this.constraints) {
      solver.add(constraint.toZ3Expr(ctx));
    }

    const result = await solver.check();
    if (result === "sat") {
      const model = solver.model();
      const assignments = new Map<string, bigint | boolean>();
      for (const decl of model.decls()) {
        const value = model.get(decl);
        const name = decl.name().toString();
        if (ctx.isIntVal(value)) {
          assignments.set(name, (value as IntNum).value());
        } else if (ctx.isBool(value)) {
          assignments.set(name, ctx.isTrue(value));
        } else if (ctx.isRealVal(value)) {
          assignments.set(name, BigInt((value as RatNum).asNumber()));
        } else {
        }
      }
      return assignments;
    } else {
      throw new Error("Path condition is unsatisfiable");
    }
  }
}

/**
 * Represents the symbolic state during program execution.
 */
export class SymState {
  variables: Map<string, SymExpr<any>> = new Map();

  clone(): SymState {
    const newState = new SymState();
    newState.variables = new Map(this.variables);
    return newState;
  }

  setVar(name: string, expr: SymExpr<any>) {
    this.variables.set(name, expr);
  }

  getVar(name: string): SymExpr<any> | undefined {
    return this.variables.get(name);
  }
}

export class SymExecutionResult {
  state: SymState;
  pathCondition: PathCondition;
  returnValue: SymExpr<any> | null;

  constructor(
    state: SymState,
    pathCondition: PathCondition,
    returnValue: SymExpr<any> | null,
  ) {
    this.state = state;
    this.pathCondition = pathCondition;
    this.returnValue = returnValue;
  }

  async getConcreteInputs(
    ctx: Context,
  ): Promise<Map<string, bigint | boolean>> {
    return await this.pathCondition.getModel(ctx);
  }
}
