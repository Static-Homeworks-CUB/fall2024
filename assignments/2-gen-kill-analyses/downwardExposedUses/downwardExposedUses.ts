import * as fs from "fs";
import * as path from "path";
import { DataflowDetector } from "@nowarp/misti/dist/src/detectors/detector";
import { CompilationUnit } from "@nowarp/misti/dist/src/internals/ir";
import { MistiTactWarning } from "@nowarp/misti/dist/src/internals/warnings";
//import { foldExpressions } from "@nowarp/misti/dist/src/internals/tactASTUtil";
import {
  CFG,
  BasicBlockIdx,
  //BasicBlock,
  TactASTStore,
} from "@nowarp/misti/dist/src/internals/ir";
import {
  //  AstExpression,
  AstStatement,
  idText,
} from "@tact-lang/compiler/dist/grammar/ast";
import { prettyPrint } from "@tact-lang/compiler/dist/prettyPrinter";
//import { assert } from "console";

type VariableRecord = [string, BasicBlockIdx];
type VariableSet = Set<VariableRecord>;

interface LiveVariableInfo {
  /** Used in the block before any redefinition. */
  lastdef: VariableSet;
  /** Defined in the block. */
  defkill: Set<string>;
  /** Live at the entry of the block. */
  in: VariableSet;
  /** Live at the exit of the block. */
  out: VariableSet;
}

const setsAreEqual = (
  setA: Set<VariableRecord>,
  setB: Set<VariableRecord>,
): boolean =>
  setA.size === setB.size && [...setA].every((elem) => setB.has(elem));

export class DownwardExposedUses extends DataflowDetector {
  async check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    let output = "";
    cu.forEachCFG(cu.ast, (cfg) => {
      if (cfg.origin === "user") {
        const result = this.performDownwardExposedUsesAnalysis(cfg, cu.ast);
        Array.from(result.keys()).forEach((bbIdx) => {
          const bb = cfg.getBasicBlock(bbIdx)!;
          const stmt = cu.ast.getStatement(bb.stmtID)!;
          const lva = result.get(bbIdx)!;
          output += [
            `// lastdef = [${Array.from(lva.lastdef)}]`,
            `// defkill = [${Array.from(lva.defkill)}]`,
            `// in = [${Array.from(lva.in)}]`,
            `// out = [${Array.from(lva.out)}]`,
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
  private performDownwardExposedUsesAnalysis(
    cfg: CFG,
    astStore: TactASTStore,
  ): Map<BasicBlockIdx, LiveVariableInfo> {
    const liveVariableInfoMap = new Map<BasicBlockIdx, LiveVariableInfo>();

    // Step 1: Get lastdef and defkill sets for each basic block
    cfg.nodes.forEach((bb) => {
      const stmt = astStore.getStatement(bb.stmtID)!;
      liveVariableInfoMap.set(bb.idx, {
        lastdef: this.collectLastDefVariables(stmt),
        defkill: this.collectKilledVariables(stmt),
        in: new Set<[string, BasicBlockIdx]>(),
        out: new Set<[string, BasicBlockIdx]>(),
      });
    });

    // Step 2: Iteratively compute in[B] and out[B] until reaching the fixed point
    let stable = false;
    while (!stable) {
      stable = true;

      // Forward analsysis => process in straight order
      const nodesInReverse = cfg.nodes.slice();
      nodesInReverse.forEach((bb) => {
        const info = liveVariableInfoMap.get(bb.idx)!;

        // in[B] = Union of out[P] for all predecessors P of B
        const inB = new Set<VariableRecord>();
        const predecessors = cfg.getPredecessors(bb.idx);
        if (predecessors) {
          predecessors.forEach((pred) => {
            const predInfo = liveVariableInfoMap.get(pred.idx)!;
            predInfo.out.forEach((v) => inB.add(v));
          });
        }

        // out[B] = lastDef[B] ∪ (in[B] - defKill[B])
        const outB = new Set<VariableRecord>(info.lastdef);
        const inMinusKill = new Set<VariableRecord>( // out[B] - kill[B]
          [...inB].filter((v) => !info.defkill.has(v[0])),
        );
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

    return liveVariableInfoMap;
  }

  /**
   * Collects the variables used in the given statement.
   * @param stmt The statement to collect used variables from.
   * @returns A set of variable names used in the statement.
   */
  private collectKilledVariables(stmt: AstStatement): Set<string> {
    const killed = new Set<string>();

    switch (stmt.kind) {
      case "statement_assign":
      case "statement_augmentedassign":
        killed.add(this.tryExtractAssignedVarNameFromAssingment(stmt));
        break;
      default:
        break;
    }

    return killed;
  }

  /**
   * Collects the variables defined in the given statement.
   * @param stmt The statement to collect defined variables from.
   * @returns A set of variable names defined in the statement.
   */
  private collectLastDefVariables(stmt: AstStatement): VariableSet {
    const defined = new Set<VariableRecord>();
    switch (stmt.kind) {
      case "statement_let":
        defined.add([idText(stmt.name), stmt.id]);
        break;
      case "statement_assign":
      case "statement_augmentedassign":
        defined.add([
          this.tryExtractAssignedVarNameFromAssingment(stmt),
          stmt.id,
        ]);
        break;
      case "statement_foreach":
        defined.add([idText(stmt.keyName), stmt.id]);
        defined.add([idText(stmt.valueName), stmt.id]);
        break;
      default:
        break;
    }
    return defined;
  }

  private tryExtractAssignedVarNameFromAssingment(
    assignment: AstStatement,
  ): string {
    const content = assignment.loc.contents;
    if (assignment.kind === "statement_assign") {
      let name = content.startsWith("self.")
        ? content.replace("self.", "")
        : content;
      name = name.split("=")[0].trimEnd();
      return name;
    } else if (assignment.kind === "statement_augmentedassign") {
      let name = content.startsWith("self.")
        ? content.replace("self.", "")
        : content;
      name = name.split(/[+-/*//%]=/)[0].trimEnd();
      return name;
    }
    return "";
  }
}
