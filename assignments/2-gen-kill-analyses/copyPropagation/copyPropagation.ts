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

interface CopyPropagationInfo {
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

function setMinus(fromSet: Set<string>, subtrahend: Set<string>): Set<string> {
  return new Set([...fromSet].filter((v) => !subtrahend.has(v)));
}

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
export class CopyPropagation extends DataflowDetector {
  /**
   * Doesn't generate any warnings. Only performs live variables analysis and prints the result.
   */
  async check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    let output = "";
    cu.forEachCFG(cu.ast, (cfg) => {
      if (cfg.origin === "user") {
        const result = this.performCopyPropagationAnalysis(cfg, cu.ast);
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

  private performCopyPropagationAnalysis(
    cfg: CFG,
    astStore: TactASTStore,
  ): Map<BasicBlockIdx, CopyPropagationInfo> {
    const copyPropagationInfoMap = new Map<
      BasicBlockIdx,
      CopyPropagationInfo
    >();

    /**
     * Task: compute for each point all variables, the values of which are known.
     *
     *     n  n  n
     *      \ | /
     *       [b]
     *      / | \
     *     m  m  m
     *
     * gen = NEW defined vars (otherwise we die in for loops + not immediately overwritten)
     * kill = overwritten vars (btw, safe to include all defined vars, gen ⊂ kill)
     * in(b) = U out(n) for n in pred(b)
     * out = gen U (in - kill)
     */

    // Step 1: Get gen and kill sets for each basic block
    cfg.nodes.forEach((bb) => {
      const stmt = astStore.getStatement(bb.stmtID)!;
      // i hate js i hate js i hate js i hate js i hate js i hate js i hate js i hate js i hate js i hate js i hate js i hate js
      const definedVariables = this.collectDefinedVariables(stmt);
      const definedVariablesSet = new Set(definedVariables);
      const duplicatedDefinitionsSet = new Set(
        definedVariables.filter((def) => def! in definedVariablesSet),
      );
      const newDefinedVariablesSet = this.collectNewDefinedVariables(stmt);
      // i probably could have written this in kotlin with like one and a half lines and without a custom freaking setMinus
      copyPropagationInfoMap.set(bb.idx, {
        gen: setMinus(newDefinedVariablesSet, duplicatedDefinitionsSet),
        kill: definedVariablesSet,
        in: new Set<string>(),
        out: new Set<string>(),
      });
    });

    // Step 2: Iteratively compute in[B] and out[B] until reaching the fixed point
    let stable = false;
    while (!stable) {
      stable = true;

      // Forward analysis
      const nodesInReverse = cfg.nodes.slice();
      nodesInReverse.forEach((bb) => {
        const info = copyPropagationInfoMap.get(bb.idx)!;

        // in(b) = U out(n) for n in pred(b)
        const inB = new Set<string>();
        const preds = cfg.getPredecessors(bb.idx);
        if (preds) {
          preds.forEach((pred) => {
            const predInfo = copyPropagationInfoMap.get(pred.idx)!;
            predInfo.out.forEach((v) => inB.add(v));
          });
        }

        // out = gen U (in - kill)
        const outB = new Set<string>(info.gen);
        const inMinusKill = setMinus(inB, info.kill);
        inMinusKill.forEach((v) => outB.add(v));

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

    return copyPropagationInfoMap;
  }

  /**
   * Collects the variables defined in the given statement. Duplicated definitions will be repeated.
   * @param stmt The statement to collect defined variables from.
   * @returns An array of variable names defined in the statement.
   */
  private collectNewDefinedVariables(stmt: AstStatement): Set<string> {
    const defined = new Set<string>();
    switch (stmt.kind) {
      case "statement_let":
        defined.add(idText(stmt.name));
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
   * Collects the variables defined in the given statement. Duplicated definitions will be repeated.
   * @param stmt The statement to collect defined variables from.
   * @returns An array of variable names defined in the statement.
   */
  private collectDefinedVariables(stmt: AstStatement): Array<string> {
    const defined = new Array<string>();
    switch (stmt.kind) {
      case "statement_let":
        defined.push(idText(stmt.name));
        break;
      case "statement_assign":
      case "statement_augmentedassign":
        this.collectDefinedVariablesFromExpression(stmt.path, defined);
        break;
      case "statement_foreach":
        defined.push(idText(stmt.keyName));
        defined.push(idText(stmt.valueName));
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
    defined: Array<string>,
  ) {
    if (expr.kind === "id") {
      defined.push(idText(expr));
    } else if (expr.kind === "field_access") {
      // Optionally handle field assignments if needed
      // For now, we might ignore them or handle them differently
    }
    // Handle other expression kinds as needed
  }
}
