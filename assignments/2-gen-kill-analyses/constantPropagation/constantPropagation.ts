import * as fs from "fs";
import * as path from "path";
import { DataflowDetector } from "@nowarp/misti/dist/src/detectors/detector";
import { CompilationUnit } from "@nowarp/misti/dist/src/internals/ir";
import { MistiTactWarning } from "@nowarp/misti/dist/src/internals/warnings";
import {
  CFG,
  BasicBlockIdx,
  TactASTStore,
} from "@nowarp/misti/dist/src/internals/ir";
import {
  AstExpression,
  AstStatement,
  idText,
} from "@tact-lang/compiler/dist/grammar/ast";
import { prettyPrint } from "@tact-lang/compiler/dist/prettyPrinter";

type VariableSet = Set<string>;

interface ConstantPropagationInfo {
  /** Constants known at the entry of the block. */
  in: VariableSet;
  /** Constants known at the exit of the block. */
  out: VariableSet;
}

const setsAreEqual = (setA: Set<string>, setB: Set<string>): boolean =>
  setA.size === setB.size && [...setA].every((elem) => setB.has(elem));

/**
 * A detector that implements constant propagation analysis.
 *
 * Constant propagation is a forward data flow analysis that tracks constant values
 * for variables at various points in the program.
 */
export class ConstantPropagation extends DataflowDetector {
  /**
   * Doesn't generate any warnings. Only performs constant propagation and prints the result.
   */
  async check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    let output = "";
    cu.forEachCFG(cu.ast, (cfg) => {
      if (cfg.origin === "user") {
        const result = this.performConstantPropagationAnalysis(cfg, cu.ast);
        Array.from(result.keys()).forEach((bbIdx) => {
          const bb = cfg.getBasicBlock(bbIdx)!;
          const cpa = result.get(bbIdx)!;

          const entry = Array.from(cpa.in.keys()).join(", ");
          const exit = Array.from(cpa.out.keys()).join(", ");

          output += [
            `// in = {${entry}}`,
            `// out  = {${exit}}`,
            `${this.statementString(bb.stmtID, cu.ast)}`,
            "\n",
          ].join("\n");
        });
      }
    });

    // Save the output to a file
    const outputDir = path.join(__dirname);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, "result.txt");
    fs.writeFileSync(outputPath, output);
    console.log(
      `Constant propagation results saved to: ${path.relative(process.cwd(), outputPath)}`,
    );
    return [];
  }

  /**
   * Performs constant propagation analysis for the given CFG.
   * @returns A map of basic block indices to their constant propagation information.
   */
  private performConstantPropagationAnalysis(
    cfg: CFG,
    astStore: TactASTStore,
  ): Map<BasicBlockIdx, ConstantPropagationInfo> {
    const constants = new Map<BasicBlockIdx, ConstantPropagationInfo>();

    // Step 1: Initialize constant maps for each basic block
    cfg.nodes.forEach((bb) => {
      constants.set(bb.idx, {
        in: new Set<string>(),
        out: new Set<string>(),
      });
    });

    // Step 2: Iteratively compute in[B] and out[B] until reaching the fixed point
    let stable = false;
    while (!stable) {
      stable = true;

      cfg.nodes.forEach((bb) => {
        const info = constants.get(bb.idx)!;

        // in[B] = out[P] if P is the only predecessor of B; else emptySet.
        // It is possible to track more if we aso track the value of the constants.
        // Then in[B] = intersection of out[P] for all predecessors P of B
        const inB = new Set<string>();
        const predecessors = cfg.getPredecessors(bb.idx);
        if (predecessors && predecessors.length == 1) {
          const predInfo = constants.get(predecessors[0].idx)!;
          this.setUnion(inB, predInfo.out);
        }
        // Process the block's statement and propagate constants
        const stmt = astStore.getStatement(bb.stmtID)!;
        const outB = this.evaluateStatement(inB, stmt);

        // Update in[B] and out[B] if they have been changed
        // Fixed point: We terminate the loop when no changes are detected
        if (!setsAreEqual(inB, info.in)) {
          info.in = inB;
          stable = false;
        }
        if (!setsAreEqual(outB, info.out)) {
          info.out = outB;
          stable = false;
        }
      });
    }

    return constants;
  }

  /**
   * Evaluates a statement and returns the updated constant map after executing the statement.
   */
  private evaluateStatement(
    constants: VariableSet,
    stmt: AstStatement,
  ): VariableSet {
    const newConstants = new Set(constants);
    const defined = this.collectDefinedVariables(stmt);
    switch (stmt.kind) {
      case "statement_let":
      case "statement_assign":
      case "statement_augmentedassign":
        if (this.isConstantExpression(stmt.expression, constants)) {
          this.setUnion(newConstants, defined);
        } else {
          this.setDifference(newConstants, defined);
        }
        break;
      default:
        break;
    }
    return newConstants;
  }

  private isConstantExpression(
    expr: AstExpression,
    constants: VariableSet,
  ): boolean {
    switch (expr.kind) {
      case "string":
      case "number":
      case "boolean":
      case "null":
        return true;
      case "op_binary":
        return (
          this.isConstantExpression(expr.left, constants) &&
          this.isConstantExpression(expr.right, constants)
        );
      case "op_unary":
        return this.isConstantExpression(expr.operand, constants);
      case "field_access":
        return constants.has(idText(expr.field));
      case "id":
        return constants.has(idText(expr));
      case "method_call":
      case "static_call":
      case "struct_instance":
      case "init_of":
        return false;
      case "conditional":
        return (
          this.isConstantExpression(expr.condition, constants) &&
          this.isConstantExpression(expr.thenBranch, constants) &&
          this.isConstantExpression(expr.elseBranch, constants)
        );
    }
  }

  /**
   * Collects the variables defined in the given statement.
   * @param stmt The statement to collect defined variables from.
   * @returns A set of variable names defined in the statement.
   */
  private collectDefinedVariables(stmt: AstStatement): VariableSet {
    const defined = new Set<string>();
    switch (stmt.kind) {
      case "statement_let":
        defined.add(idText(stmt.name));
        break;
      case "statement_assign":
      case "statement_augmentedassign":
        this.collectDefinedVariablesFromExpression(stmt.path, defined);
        break;
      case "statement_foreach":
        defined.add(idText(stmt.keyName));
        defined.add(idText(stmt.valueName));
        break;
      case "statement_return":
      case "statement_expression":
      case "statement_condition":
      case "statement_while":
      case "statement_until":
      case "statement_repeat":
      case "statement_try":
        break;
      case "statement_try_catch":
        defined.add(idText(stmt.catchName));
        break;
    }
    return defined;
  }

  /**
   * Collects variables defined in an expression (e.g., LHS of an assignment).
   */
  private collectDefinedVariablesFromExpression(
    expr: AstExpression,
    defined: VariableSet,
  ) {
    switch (expr.kind) {
      case "field_access":
        defined.add(idText(expr.field));
        break;
      case "id":
        defined.add(idText(expr));
        break;
      case "op_unary":
      case "string":
      case "number":
      case "boolean":
      case "op_binary":
      case "method_call":
      case "static_call":
      case "struct_instance":
      case "null":
      case "init_of":
      case "conditional":
    }
  }

  private setUnion(lhs: Set<string>, rhs: Set<string>) {
    for (const elm of rhs) {
      lhs.add(elm);
    }
  }

  private setDifference(lhs: Set<string>, rhs: Set<string>) {
    for (const elm of rhs) {
      lhs.delete(elm);
    }
  }

  private statementString(stmtID: number, astStore: TactASTStore): string {
    return prettyPrint(astStore.getStatement(stmtID)!)
      .split("\n")[0]
      .split("{")[0]
      .trim();
  }
}
