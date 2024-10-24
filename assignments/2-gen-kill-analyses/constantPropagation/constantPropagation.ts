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

interface LiveVariableInfo {
  /** Used in the block before any redefinition. */
  gen: VariableSet;
  /** Defined in the block. */
  kill: VariableSet;
  /** Live at the entry of the block. */
  in: VariableSet;
  /** Live at the exit of the block. */
  out: VariableSet;
}

const setsAreEqual = (setA: Set<string>, setB: Set<string>): boolean =>
  setA.size === setB.size && [...setA].every((elem) => setB.has(elem));

/**
 * An example detector that implements live variables analysis.
 *
 * Live variables analysis is a backward analysis that tracks which variables are
 * live (used) at various points in the program. It is used to detect unused
 * variables, dead code, etc. or provide compiler optimizations.
 *
 * Use the following command to run it:
 *  export DIR=assignments/2-gen-kill-analyses/liveVariables
 *  yarn misti --detectors $DIR/liveVariables.ts:LiveVariables $DIR/live-variables.tact
 */
export class LiveVariables extends DataflowDetector {
  /**
   * Doesn't generate any warnings. Only performs live variables analysis and prints the result.
   */
  async check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    let output = "";
    cu.forEachCFG(cu.ast, (cfg) => {
      if (cfg.origin === "user") {
        const result = this.performLiveVariableAnalysis(cfg, cu.ast);
        Array.from(result.keys()).forEach((bbIdx) => {
          const bb = cfg.getBasicBlock(bbIdx)!;
          const stmt = cu.ast.getStatement(bb.stmtID)!;
          const lva = result.get(bbIdx)!;
          output += [
            `// gen  = [${Array.from(lva.gen)}]`,
            `// kill = [${Array.from(lva.kill)}]`,
            `// in   = [${Array.from(lva.in)}]`,
            `// out  = [${Array.from(lva.out)}]`,
            `${prettyPrint(stmt).split("\n")[0].split("{")[0].trim()}`,
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
      `Live variables analysis results saved to: ${path.relative(process.cwd(), outputPath)}`,
    );
    return [];
  }

  /**
   * Performs live variables analysis for the given CFG.
   * @returns A map of basic block indices to their live variable information.
   */
  private performLiveVariableAnalysis(
    cfg: CFG,
    astStore: TactASTStore,
  ): Map<BasicBlockIdx, LiveVariableInfo> {
    const liveVariableInfoMap = new Map<BasicBlockIdx, LiveVariableInfo>();

    // Step 1: Get gen and kill sets for each basic block
    cfg.nodes.forEach((bb) => {
      const stmt = astStore.getStatement(bb.stmtID)!;
      liveVariableInfoMap.set(bb.idx, {
        gen: this.collectUsedVariables(stmt),
        kill: this.collectDefinedVariables(stmt),
        in: new Set<string>(),
        out: new Set<string>(),
      });
    });

    // Step 2: Iteratively compute in[B] and out[B] until reaching the fixed point
    let stable = false;
    while (!stable) {
      stable = true;

      // Backward analsysis => process in reverse order
      const nodesInReverse = cfg.nodes.slice().reverse();
      nodesInReverse.forEach((bb) => {
        const info = liveVariableInfoMap.get(bb.idx)!;

        // out[B] = Union of in[S] for all successors S of B
        const outB = new Set<string>();
        const successors = cfg.getSuccessors(bb.idx);
        if (successors) {
          successors.forEach((succ) => {
            const succInfo = liveVariableInfoMap.get(succ.idx)!;
            succInfo.in.forEach((v) => outB.add(v));
          });
        }

        // in[B] = gen[B] ∪ (out[B] - kill[B])
        const inB = new Set<string>(info.gen);
        const outMinusKill = new Set<string>( // out[B] - kill[B]
          [...outB].filter((v) => !info.kill.has(v)),
        );
        outMinusKill.forEach((v) => inB.add(v));

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

    return liveVariableInfoMap;
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
      case "statement_let":
        if (stmt.expression) collectExpr(stmt.expression);
        break;
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
      // For now, we might ignore them or handle them differently
    }
    // Handle other expression kinds as needed
  }
}
