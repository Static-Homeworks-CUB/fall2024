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

/**
 * Represents a set of definitions in the program.
 */
type DefinitionSet = Set<number>;

/**
 * Contains the reaching definitions information for a basic block in the control flow graph.
 */
interface UseDefinitionInfo {
  gen: DefinitionSet;
  kill: DefinitionSet;
  in: DefinitionSet;
  out: DefinitionSet;
}

export class UseDefinitionChains extends DataflowDetector {
  async check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    let output = "";

    cu.forEachCFG(cu.ast, (cfg) => {
      if (cfg.origin === "user") {
        const result = this.performReachingDefinitionsAnalysis(cfg, cu.ast);

        cfg.nodes.forEach((bb) => {
          const bbIdx = bb.idx;
          const stmt = cu.ast.getStatement(bb.stmtID);
          const rdInfo = result.get(bbIdx)!;

          const genDefs = Array.from(rdInfo.gen).map((id) =>
            this.prettyPrintDefinition(cu.ast.getStatement(id)!),
          );
          const killDefs = Array.from(rdInfo.kill).map((id) =>
            this.prettyPrintDefinition(cu.ast.getStatement(id)!),
          );
          const inDefs = Array.from(rdInfo.in).map((id) =>
            this.prettyPrintDefinition(cu.ast.getStatement(id)!),
          );
          const outDefs = Array.from(rdInfo.out).map((id) =>
            this.prettyPrintDefinition(cu.ast.getStatement(id)!),
          );

          if (stmt) {
            output += [
              `// gen  = [${genDefs.join(", ")}]`,
              `// kill = [${killDefs.join(", ")}]`,
              `// in   = [${inDefs.join(", ")}]`,
              `// out  = [${outDefs.join(", ")}]`,
              `${prettyPrint(stmt).split("\n")[0].split("{")[0].trim()}`,
              "\n",
            ].join("\n");
          }
        });
      }
    });

    const outputDir = path.join(__dirname);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, "result.txt");
    fs.writeFileSync(outputPath, output);
    return [];
  }

  private variableDefinitions = new Map<string, Set<number>>();

  private uses = new Map<BasicBlockIdx, Set<string>>();

  private performReachingDefinitionsAnalysis(
    cfg: CFG,
    astStore: TactASTStore,
  ): Map<BasicBlockIdx, UseDefinitionInfo> {
    this.collectAllDefinitions(cfg, astStore);

    const rdInfoMap = new Map<BasicBlockIdx, UseDefinitionInfo>();

    // Initialize rdInfoMap and collect uses
    cfg.nodes.forEach((bb) => {
      const bbIdx = bb.idx;
      const stmt = astStore.getStatement(bb.stmtID);
      const gen = stmt
        ? this.collectDefinitionsInStatement(stmt)
        : new Set<number>();
      const kill = stmt
        ? this.collectKilledDefinitions(stmt, astStore)
        : new Set<number>();

      rdInfoMap.set(bbIdx, {
        gen,
        kill,
        in: new Set<number>(),
        out: new Set<number>(gen),
      });

      if (stmt) {
        const usedVars = this.collectUsedVariables(stmt);
        if (usedVars.size > 0) {
          this.uses.set(bbIdx, usedVars);
        }
      }
    });

    // Simple iterative loop over CFG nodes
    let changed = true;
    while (changed) {
      changed = false;
      cfg.nodes.forEach((bb) => {
        const bbIdx = bb.idx;
        const info = rdInfoMap.get(bbIdx)!;

        // Compute in[B]
        const inB = new Set<number>();
        const preds = cfg.getPredecessors(bbIdx) || [];
        preds.forEach((pred) => {
          const predInfo = rdInfoMap.get(pred.idx)!;
          predInfo.out.forEach((defId) => inB.add(defId));
        });

        // Compute out[B]
        const outB = new Set<number>(info.gen);
        inB.forEach((defId) => {
          if (!info.kill.has(defId)) {
            outB.add(defId);
          }
        });

        // Check for changes
        const inChanged = !this.setsAreEqual(inB, info.in);
        const outChanged = !this.setsAreEqual(outB, info.out);

        if (inChanged || outChanged) {
          info.in = inB;
          info.out = outB;
          changed = true;
        }
      });
    }

    return rdInfoMap;
  }

  private collectAllDefinitions(cfg: CFG, astStore: TactASTStore) {
    cfg.nodes.forEach((bb) => {
      const stmt = astStore.getStatement(bb.stmtID)!;
      const definedVars = this.getDefinedVariables(stmt);
      if (definedVars.size > 0) {
        definedVars.forEach((variable) => {
          if (!this.variableDefinitions.has(variable)) {
            this.variableDefinitions.set(variable, new Set<number>());
          }
          this.variableDefinitions.get(variable)!.add(stmt.id);
        });
      }
    });
  }

  private collectDefinitionsInStatement(stmt: AstStatement): DefinitionSet {
    const definedVars = this.getDefinedVariables(stmt);
    const definitions = new Set<number>();

    if (definedVars.size > 0) {
      definitions.add(stmt.id);
    }

    return definitions;
  }

  private collectKilledDefinitions(
    stmt: AstStatement,
    astStore: TactASTStore,
  ): DefinitionSet {
    const killedDefinitions = new Set<number>();
    const definedVars = this.getDefinedVariables(stmt);

    definedVars.forEach((variable) => {
      const allDefs = this.variableDefinitions.get(variable);
      if (allDefs) {
        allDefs.forEach((defId) => {
          if (defId !== stmt.id) {
            const defStmt = astStore.getStatement(defId)!;
            if (defStmt.loc && stmt.loc) {
              if (defStmt.loc.interval.startIdx < stmt.loc.interval.startIdx) {
                killedDefinitions.add(defId);
              }
            }
          }
        });
      }
    });

    return killedDefinitions;
  }

  private getDefinedVariables(stmt: AstStatement): Set<string> {
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

  private collectDefinedVariablesFromExpression(
    expr: AstExpression,
    defined: Set<string>,
  ) {
    if (expr.kind === "id") {
      defined.add(idText(expr));
    } else if (expr.kind === "field_access") {
      this.collectDefinedVariablesFromExpression(expr.field, defined);
    }
  }

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

  private setsAreEqual<T>(setA: Set<T>, setB: Set<T>): boolean {
    return setA.size === setB.size && [...setA].every((elem) => setB.has(elem));
  }

  private prettyPrintDefinition(stmt: AstStatement): string {
    const code = prettyPrint(stmt).split("\n")[0].split("{")[0].trim();
    return `${code}`; // Removed the ID from the output
  }
}
