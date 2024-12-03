import * as fs from "fs";
import * as path from "path";
import { DataflowDetector } from "@nowarp/misti/dist/src/detectors/detector";
import { CompilationUnit } from "@nowarp/misti/dist/src/internals/ir";
import { MistiTactWarning } from "@nowarp/misti/dist/src/internals/warnings";
import { foldExpressions } from "@nowarp/misti/dist/src/internals/tactASTUtil";
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

interface DefiniteAssignmentInfo {
  /** Variables that are assigned within the block. */
  def: VariableSet;
  /** Variables that are used within the block before any reassignment. */
  use: VariableSet;
  /** Variables that are definitely assigned at the entry of the block. */
  in: VariableSet;
  /** Variables that are definitely assigned at the exit of the block. */
  out: VariableSet;
}

const setsAreEqual = (setA: Set<string>, setB: Set<string>): boolean =>
  setA.size === setB.size && [...setA].every((elem) => setB.has(elem));

export class DefiniteAssignment extends DataflowDetector {
  async check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    let output = "";
    cu.forEachCFG(cu.ast, (cfg) => {
      if (cfg.origin === "user") {
        const result = this.performDefiniteAssignmentAnalysis(cfg, cu.ast);
        Array.from(result.keys()).forEach((bbIdx) => {
          const bb = cfg.getBasicBlock(bbIdx)!;
          const stmt = cu.ast.getStatement(bb.stmtID)!;
          const da = result.get(bbIdx)!;
          output += [
            `// def = [${Array.from(da.def)}]`,
            `// use = [${Array.from(da.use)}]`,
            `// in = [${Array.from(da.in)}]`,
            `// out = [${Array.from(da.out)}]`,
            `${prettyPrint(stmt).split("\n")[0].split("{")[0].trim()}`,
            "\n",
          ].join("\n");
        });
      }
    });

    // Save output to a file
    const outputDir = path.join(__dirname);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, "result.txt");
    fs.writeFileSync(outputPath, output);
    console.log(
      `Definite assignment analysis results saved to: ${path.relative(process.cwd(), outputPath)}`,
    );
    return [];
  }

  private performDefiniteAssignmentAnalysis(
    cfg: CFG,
    astStore: TactASTStore,
  ): Map<BasicBlockIdx, DefiniteAssignmentInfo> {
    const defAssignInfoMap = new Map<BasicBlockIdx, DefiniteAssignmentInfo>();

    // Step 1: Get def and use sets for each basic block
    cfg.nodes.forEach((bb) => {
      const stmt = astStore.getStatement(bb.stmtID)!;
      defAssignInfoMap.set(bb.idx, {
        def: this.collectDefinedVariables(stmt),
        use: this.collectUsedVariables(stmt),
        in: new Set<string>(),
        out: new Set<string>(),
      });
    });

    // Step 2: Iteratively compute in[B] and out[B] until reaching the fixed point
    let stable = false;
    while (!stable) {
      stable = true;

      cfg.nodes.forEach((bb) => {
        const info = defAssignInfoMap.get(bb.idx)!;

        // in[B] = Intersection of out[P] for all predecessors P of B
        const inB = new Set<string>();
        const predecessors = cfg.getPredecessors(bb.idx);
        if (predecessors) {
          predecessors.forEach((pred) => {
            const predInfo = defAssignInfoMap.get(pred.idx)!;
            if (inB.size === 0) {
              predInfo.out.forEach((v) => {
                inB.add(v);
              });
            } else {
              // Perform intersection with predInfo.out
              for (const v of inB) {
                if (!predInfo.out.has(v)) inB.delete(v);
              }
            }
          });
        }

        // out[B] = def[B] ∪ (in[B] - use[B])
        const outB = new Set<string>(info.def);
        const inMinusUse = new Set<string>(
          [...inB].filter((v) => !info.use.has(v)),
        );
        inMinusUse.forEach((v) => outB.add(v));

        // Update in[B] and out[B] if they have been changed
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

    return defAssignInfoMap;
  }

  /**
   * Collects the variables used in the given statement.
   * @param stmt The statement to collect used variables from.
   * @returns A set of variable names used in the statement.
   */
  private collectUsedVariables(stmt: AstStatement): VariableSet {
    const used = new Set<string>();
    const collectExpr = (expr: AstExpression) => {
      foldExpressions(expr, used, (acc, expr) => {
        if (expr.kind === "id") acc.add(idText(expr));
        return acc;
      });
    };

    switch (stmt.kind) {
      case "statement_assign":
      case "statement_augmentedassign":
        collectExpr(stmt.expression);
        break;
      case "statement_return":
        if (stmt.expression) collectExpr(stmt.expression);
        break;
      case "statement_expression":
        collectExpr(stmt.expression);
        break;
      case "statement_condition":
        collectExpr(stmt.condition);
        break;
      case "statement_while":
      case "statement_until":
        collectExpr(stmt.condition);
        break;
      case "statement_repeat":
        collectExpr(stmt.iterations);
        break;
      case "statement_foreach":
        collectExpr(stmt.map);
        break;
      default:
        break;
    }

    return used;
  }

  /**
   * Collects the variables defined in the given statement.
   * @param stmt The statement to collect defined variables from.
   * @returns A set of variable names defined in the statement.
   */
  private collectDefinedVariables(stmt: AstStatement): VariableSet {
    const defined = new Set<string>();
    switch (stmt.kind) {
      case "statement_assign":
      case "statement_augmentedassign":
        this.collectDefinedVariablesFromExpression(stmt.path, defined);
        break;
      default:
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
    if (expr.kind === "id") {
      defined.add(idText(expr));
    } else if (expr.kind === "field_access") {
      // Optionally handle field assignments if needed
    }
  }
}
