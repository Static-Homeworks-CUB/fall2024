import { DataflowDetector } from "@nowarp/misti/dist/src/detectors/detector";
import {
  BasicBlock,
  BasicBlockIdx,
  CFG,
  CompilationUnit,
  TactASTStore,
} from "@nowarp/misti/dist/src/internals/ir";
import { MistiTactWarning } from "@nowarp/misti/dist/src/internals/warnings";
import {
  AstExpression,
  AstStatement,
  idText,
} from "@tact-lang/compiler/dist/grammar/ast";
import { prettyPrint } from "@tact-lang/compiler/dist/prettyPrinter";

// StatementID of a definition
type DefID = number;

// Dataflow analysis information for a basic block
interface Info {
  gen: Set<DefID>;
  kill: Set<DefID>;
  in: Set<DefID>;
  out: Set<DefID>;
}

/**
 * Formats the dataflow analysis information for a basic block.
 * @param info information to format
 * @param ast corresponding AST store
 * @returns formatted string
 */
function printInfo(info: Info, ast: TactASTStore): string {
  const printDefs = (defs: Set<DefID>) =>
    Array.from(defs)
      .map((def) => {
        const loc = ast.getStatement(def)!.loc;
        const line = loc.interval.getLineAndColumn().lineNum.toString();
        return `${loc.contents} (L:${line.padStart(3, "0")})`;
      })
      .join(", ");

  return [
    `gen  = [${printDefs(info.gen)}]`,
    `kill = [${printDefs(info.kill)}]`,
    `in   = [${printDefs(info.in)}]`,
    `out  = [${printDefs(info.out)}]`,
  ].join("\n");
}

// Context for dataflow analysis of a CFG
interface AnalysisCTX {
  cfg: CFG;
  // AST corresponding to the CFG
  ast: TactASTStore;
  // Dataflow analysis information for each basic block in the CFG
  infos: Map<BasicBlockIdx, Info>;
}

export class UpwardExposedDefinitions extends DataflowDetector {
  check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    cu.forEachCFG(cu.ast, (cfg) => {
      // Skip non-user code
      if (cfg.origin !== "user") return;

      // Perform the analysis
      const infos = this.performAnalysis(cfg, cu.ast);

      // Print results of the analysis
      for (const [bbIdx, info] of infos) {
        const bb = cfg.getBasicBlock(bbIdx)!;
        const stmt = cu.ast.getStatement(bb.stmtID)!;
        const line = stmt.loc.interval.getLineAndColumn().lineNum.toString();
        const repr = prettyPrint(stmt).split("\n")[0].split("{")[0].trim();

        console.log(
          `BB ${bbIdx}: ${repr} (L:${line.padStart(3, "0")})\n${printInfo(info, cu.ast)}`,
        );
      }
    });

    return Promise.resolve([]);
  }

  /**
   * Performs the dataflow analysis on the given CFG.
   * @param cfg CFG to analyze
   * @param ast AST store corresponding to the CFG
   * @returns result of the analysis for each block
   */
  private performAnalysis(
    cfg: CFG,
    ast: TactASTStore,
  ): Map<BasicBlockIdx, Info> {
    // Intialize the context (gen and kill sets)
    const ctx = this.initCTX(cfg, ast);
    // Define backward direction of the analysis
    const nodes = cfg.nodes.slice().reverse();

    // Compute fix point
    let stable = false;
    while (!stable) {
      stable = true;

      for (const node of nodes) {
        stable = this.iterate(ctx, node) && stable;
      }
    }

    return ctx.infos;
  }

  /**
   * Perform a single iteration of fix point computation
   * @param ctx current analysis context
   * @param node current basic block
   * @returns whether the in/out sets have changed for the block
   */
  private iterate(ctx: AnalysisCTX, node: BasicBlock): boolean {
    const info = ctx.infos.get(node.idx)!;
    // out = U_{s in succ} in[s]
    const newOut: Set<DefID> = ctx.cfg
      .getSuccessors(node.idx)!
      .flatMap((succ) => ctx.infos.get(succ.idx)!.in)
      .reduce(union, new Set());
    // in = gen U (out - kill)
    const newIn = union(info.gen, diff(newOut, info.kill));

    info.in = newIn;
    info.out = newOut;

    return equal(newIn, info.in) && equal(newOut, info.out);
  }

  /**
   * Initializes the context for the dataflow analysis.
   * @param cfg CFG to analyze
   * @param ast AST store corresponding to the CFG
   * @returns initialized context
   */
  private initCTX(cfg: CFG, ast: TactASTStore): AnalysisCTX {
    // Map: stmtID -> defined variables
    const stmtDefs = new Map<number, Set<string>>();
    cfg.forEachBasicBlock(ast, (stmt, bb) => {
      const defined = this.collectDefinedVariables(stmt);
      stmtDefs.set(bb.stmtID, defined);
    });

    // Map: variable -> set of definitions ids
    const varDefs = new Map<string, Set<DefID>>();
    cfg.nodes.forEach((bb) => {
      const defined = stmtDefs.get(bb.stmtID)!;
      for (const def of defined) {
        const defs = varDefs.get(def);
        if (defs) {
          defs.add(bb.stmtID);
        } else {
          varDefs.set(def, new Set([bb.stmtID]));
        }
      }
    });

    // Initialize gen and kill sets for each basic block
    const infos = new Map<BasicBlockIdx, Info>();
    cfg.forEachBasicBlock(ast, (stmt, bb) => {
      // I DON"T UNDERSTAND WHAT GEN AND KILL SHOULD BE
      const defined = this.collectDefinedVariables(stmt);
      const gen = defined.size === 0 ? new Set<DefID>() : new Set([bb.stmtID]);
      const kill = [...defined]
        .flatMap((def) => varDefs.get(def) ?? [])
        .reduce(union, new Set());
      kill.delete(bb.stmtID);
      // ----------------------------------------------

      infos.set(bb.idx, {
        gen: gen,
        kill: kill,
        in: new Set(),
        out: new Set(),
      });
    });

    return { cfg, ast, infos };
  }

  /**
   * Collects the variables defined in the given statement.
   * @param stmt statement to analyze
   * @returns set of defined variables
   */
  private collectDefinedVariables(stmt: AstStatement): Set<string> {
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
   * Collects the variables defined in the given expression.
   * @param expr expression to analyze
   * @param defined set of defined variables
   * @note This function is incomplete and should be extended to handle all cases
   */
  private collectDefinedVariablesFromExpression(
    expr: AstExpression,
    defined: Set<string>,
  ) {
    if (expr.kind === "id") {
      defined.add(idText(expr));
    }
    // Other cases unhandled
  }
}

// Helper functions for set operations
function equal<T>(a: Set<T>, b: Set<T>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

function union<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a, ...b]);
}

function diff<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a].filter((x) => !b.has(x)));
}
