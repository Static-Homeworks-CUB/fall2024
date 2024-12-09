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
import { AstStatement, idText } from "@tact-lang/compiler/dist/grammar/ast";
import { prettyPrint } from "@tact-lang/compiler/dist/prettyPrinter";

type VariableRecord = [string, number, number];
type VariableSet = Set<VariableRecord>;

interface DownwardExposedUsesData {
  /** Used in the block before any redefinition. */
  use: VariableSet;
  /** Defined in the block. */
  def: Set<string>;
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
            `// use = [${Array.from(lva.use)}]`,
            `// def = [${Array.from(lva.def)}]`,
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
  ): Map<BasicBlockIdx, DownwardExposedUsesData> {
    const downwardExposedInfoMap = new Map<
      BasicBlockIdx,
      DownwardExposedUsesData
    >();

    // Step 1: Get use and def sets for each basic block
    cfg.nodes.forEach((bb) => {
      const stmt = astStore.getStatement(bb.stmtID)!;
      downwardExposedInfoMap.set(bb.idx, {
        use: this.collectUseVariables(stmt),
        def: this.collectDefVariables(stmt),
        in: new Set<VariableRecord>(),
        out: new Set<VariableRecord>(),
      });
    });

    // Step 2: Iteratively compute in[B] and out[B] until reaching the fixed point
    let stable = false;
    while (!stable) {
      stable = true;

      // Forward analsysis => process in straight order
      const nodes = cfg.nodes.slice();
      nodes.forEach((bb) => {
        const info = downwardExposedInfoMap.get(bb.idx)!;

        // in[B] = Union of out[P] for all predecessors P of B
        const inB = new Set<VariableRecord>();
        const predecessors = cfg.getPredecessors(bb.idx);
        if (predecessors) {
          predecessors.forEach((pred) => {
            const predInfo = downwardExposedInfoMap.get(pred.idx)!;
            predInfo.out.forEach((v) => inB.add(v));
          });
        }

        // out[B] = lastDef[B] ∪ (in[B] - defKill[B])
        const outB = new Set<VariableRecord>(info.use);
        const inMinusKill = new Set<VariableRecord>( // out[B] - kill[B]
          [...inB].filter((v) => !info.def.has(v[0])),
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

    return downwardExposedInfoMap;
  }

  /**
   * Collects the variables used in the given statement.
   * @param stmt The statement to collect used variables from.
   * @returns A set of variable names used in the statement.
   */
  private collectDefVariables(stmt: AstStatement): Set<string> {
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
  private collectUseVariables(stmt: AstStatement): VariableSet {
    const defined = new Set<VariableRecord>();
    const locationInfo = stmt.loc.interval.getLineAndColumn();
    switch (stmt.kind) {
      case "statement_let":
        defined.add([
          idText(stmt.name),
          locationInfo.lineNum,
          locationInfo.colNum,
        ]);
        break;
      case "statement_assign":
      case "statement_augmentedassign":
        defined.add([
          this.tryExtractAssignedVarNameFromAssingment(stmt),
          locationInfo.lineNum,
          locationInfo.colNum,
        ]);
        break;
      case "statement_foreach":
        defined.add([
          idText(stmt.keyName),
          locationInfo.lineNum,
          locationInfo.colNum,
        ]);
        defined.add([
          idText(stmt.valueName),
          locationInfo.lineNum,
          locationInfo.colNum,
        ]);
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
