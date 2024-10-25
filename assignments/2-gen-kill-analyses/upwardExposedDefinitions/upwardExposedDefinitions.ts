import { DataflowDetector } from "@nowarp/misti/dist/src/detectors/detector";
import {
  BasicBlock,
  BasicBlockIdx,
  CFG,
  CompilationUnit,
  TactASTStore,
} from "@nowarp/misti/dist/src/internals/ir";
import { foldExpressions } from "@nowarp/misti/dist/src/internals/tactASTUtil";
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
 * Formats the definition.
 * @param def definition id to format
 * @param ast corresponding AST store
 * @returns formatted string
 **/
function printDef(def: DefID, ast: TactASTStore): string {
  const loc = ast.getStatement(def)!.loc;
  const line = loc.interval.getLineAndColumn().lineNum.toString();

  return `${loc.contents} (L:${line.padStart(3, "0")})`;
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
      .map((def) => printDef(def, ast))
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

  // Additional information from source code
  // Map: variable -> set of its definitions ids
  varDefs: Map<string, Set<DefID>>;
}

export class UpwardExposedDefinitions extends DataflowDetector {
  check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    let output = "";
    cu.forEachCFG(cu.ast, (cfg) => {
      // Skip non-user code
      if (cfg.origin !== "user") return;

      // Perform the analysis
      const result = this.performAnalysis(cfg, cu.ast);

      // Print results of the analysis
      for (const [bbIdx, info] of result.infos) {
        const bb = cfg.getBasicBlock(bbIdx)!;
        const stmt = cu.ast.getStatement(bb.stmtID)!;

        const usedVars = this.collectUsedVariables(stmt);
        const maybeUsedDefs = [...usedVars]
          .map((v) => result.varDefs.get(v) ?? new Set<DefID>())
          .reduce(union, new Set<DefID>());
        const usedDefs = inter(maybeUsedDefs, info.out);
        const used = [...usedDefs]
          .map((def) => printDef(def, cu.ast))
          .join(", ");

        const line = stmt.loc.interval.getLineAndColumn().lineNum.toString();
        const repr = prettyPrint(stmt).split("\n")[0].split("{")[0].trim();

        output += `${repr} (L:${line.padStart(3, "0")})\n`;
        output += printInfo(info, cu.ast) + "\n";
        output += `result = [${used}]\n`;
      }
    });

    console.log(output);

    return Promise.resolve([]);
  }

  /**
   * Performs the dataflow analysis on the given CFG.
   * @param cfg CFG to analyze
   * @param ast AST store corresponding to the CFG
   * @returns resulting ctx of the analysis
   */
  private performAnalysis(cfg: CFG, ast: TactASTStore): AnalysisCTX {
    // Intialize the context (gen and kill sets)
    const ctx = this.initCTX(cfg, ast);
    // Define forward direction of the analysis
    const nodes = cfg.nodes;

    // Compute fix point
    let stable = false;
    while (!stable) {
      stable = true;

      for (const node of nodes) {
        stable = this.iterate(ctx, node) && stable;
      }
    }

    return ctx;
  }

  /**
   * Perform a single iteration of fix point computation
   * @param ctx current analysis context
   * @param node current basic block
   * @returns whether the in/out sets have changed for the block
   */
  private iterate(ctx: AnalysisCTX, node: BasicBlock): boolean {
    const info = ctx.infos.get(node.idx)!;
    // out = U_{p in pred} in[p]
    const newOut: Set<DefID> = ctx.cfg
      .getPredecessors(node.idx)!
      .map((pred) => ctx.infos.get(pred.idx)!.in)
      .reduce(union, new Set());
    // in = gen U (out - kill)
    const newIn = union(info.gen, diff(newOut, info.kill));

    const stable = equal(newIn, info.in) && equal(newOut, info.out);

    if (!stable) {
      info.in = newIn;
      info.out = newOut;
    }

    return stable;
  }

  /**
   * Initializes the context for the dataflow analysis.
   * @param cfg CFG to analyze
   * @param ast AST store corresponding to the CFG
   * @returns initialized context
   */
  private initCTX(cfg: CFG, ast: TactASTStore): AnalysisCTX {
    // Map: statement id -> defined variables
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
      const defined = this.collectDefinedVariables(stmt);
      const gen = new Set<DefID>(defined.size ? [bb.stmtID] : []);
      const kill = [...defined]
        .flatMap((def) => varDefs.get(def) ?? [])
        .reduce(union, new Set());
      kill.delete(bb.stmtID);

      infos.set(bb.idx, {
        gen: gen,
        kill: kill,
        in: new Set(),
        out: new Set(),
      });
    });

    return { cfg, ast, infos, varDefs };
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
   * @param defined set of defined variables to update
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

  /**
   * Collects the variables used in the given statement.
   * @param stmt statement to analyze
   * @returns set of used variables
   */
  private collectUsedVariables(stmt: AstStatement): Set<string> {
    const used = new Set<string>();
    const collectExpr = (expr: AstExpression) => {
      foldExpressions(expr, used, (acc, expr) => {
        if (expr.kind === "id") acc.add(idText(expr));
        return acc;
      });
    };

    switch (stmt.kind) {
      case "statement_let":
      case "statement_assign":
      case "statement_augmentedassign":
      case "statement_return":
      case "statement_expression":
        if (stmt.expression) collectExpr(stmt.expression);
        break;
      case "statement_condition":
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

function inter<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a].filter((x) => b.has(x)));
}
