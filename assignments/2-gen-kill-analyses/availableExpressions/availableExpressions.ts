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
  AstStructFieldInitializer,
  AstExpression,
  AstStatement,
} from "@tact-lang/compiler/dist/grammar/ast";
import { prettyPrint } from "@tact-lang/compiler/dist/prettyPrinter";

interface AvailableExpressionInfo {
  gen: Set<AstExpression>;
  kill: Set<AstExpression>;
  in: Set<AstExpression>;
  out: Set<AstExpression>;
}

/**
 * Use the following command to run it:
 *  export DIR=assignments/2-gen-kill-analyses/availableExpressions
 *  yarn misti --detectors $DIR/availableExpressions.ts:AvailableExpressions $DIR/contract.tact
 */
export class AvailableExpressions extends DataflowDetector {
  async check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    let output = "";
    cu.forEachCFG(cu.ast, (cfg) => {
      if (cfg.origin === "user") {
        const result = this.performAvailableExpressionsAnalysis(cfg, cu.ast);
        Array.from(result.keys()).forEach((bbIdx) => {
          const bb = cfg.getBasicBlock(bbIdx)!;
          const stmt = cu.ast.getStatement(bb.stmtID)!;
          const lva = result.get(bbIdx)!;
          output += [
            `// gen  = [${Array.from(lva.gen).map((expr, _, __) => prettyPrint(expr))}]`,
            `// kill = [${Array.from(lva.kill).map((expr, _, __) => prettyPrint(expr))}]`,
            `// in   = [${Array.from(lva.in).map((expr, _, __) => prettyPrint(expr))}]`,
            `// out  = [${Array.from(lva.out).map((expr, _, __) => prettyPrint(expr))}]`,
            `${prettyPrint(stmt).split("\n")[0].split("{")[0].trim()}`,
            "\n",
          ].join("\n");
        });
      }
    });

    const outputDir = path.join(__dirname);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, "result.txt");
    fs.writeFileSync(outputPath, output);
    console.log(
      `Available expressions analysis results saved to: ${path.relative(process.cwd(), outputPath)}`,
    );
    return [];
  }

  private setsAreEqual(
    setA: Set<AstExpression>,
    setB: Set<AstExpression>,
  ): boolean {
    return (
      setA.size === setB.size && [...setA].every((elem) => this.has(setB, elem))
    );
  }

  private performAvailableExpressionsAnalysis(
    cfg: CFG,
    astStore: TactASTStore,
  ): Map<BasicBlockIdx, AvailableExpressionInfo> {
    const aeInfoMap = new Map<BasicBlockIdx, AvailableExpressionInfo>();

    cfg.nodes.forEach((bb) => {
      const stmt = astStore.getStatement(bb.stmtID)!;
      aeInfoMap.set(bb.idx, {
        gen: this.collectGenExpressions(stmt),
        kill: this.collectKillExpressions(stmt),
        in: new Set<AstExpression>(),
        out: new Set<AstExpression>(),
      });
    });

    let stable = false;
    while (!stable) {
      stable = true;

      cfg.nodes.forEach((bb) => {
        const info = aeInfoMap.get(bb.idx)!;
        const inB = new Set<AstExpression>();
        const predecessors = cfg.getPredecessors(bb.idx) || [];
        if (predecessors.length > 0) {
          predecessors.forEach((pred) => {
            const predInfo = aeInfoMap.get(pred.idx)!;
            if (inB.size === 0) {
              predInfo.out.forEach((v) => {
                if (!this.has(inB, v)) inB.add(v);
              });
            } else {
              for (const v of inB) {
                if (!this.has(predInfo.out, v)) inB.delete(v);
              }
            }
          });
        }

        info.kill = this.updateKillExpressions(info.kill, inB);

        const outB = new Set<AstExpression>(info.gen);
        const inMinusKill = new Set<AstExpression>(
          [...inB].filter((v) => !this.has(info.kill, v)),
        );
        inMinusKill.forEach((v) => {
          if (!this.has(outB, v)) outB.add(v);
        });

        if (!this.setsAreEqual(inB, info.in)) {
          info.in = inB;
          stable = false;
        }
        if (!this.setsAreEqual(outB, info.out)) {
          info.out = outB;
          stable = false;
        }
      });
    }
    return aeInfoMap;
  }

  private collectGenExpressions(stmt: AstStatement): Set<AstExpression> {
    const gen = new Set<AstExpression>();
    const collectExpr = (expr: AstExpression) => {
      foldExpressions(expr, gen, (acc, expr) => {
        if (!this.has(acc, expr)) acc.add(expr);
        return acc;
      });
    };

    switch (stmt.kind) {
      case "statement_let":
        collectExpr(stmt.name);
        collectExpr(stmt.expression);
        break;
      case "statement_condition":
      case "statement_while":
        collectExpr(stmt.condition);
        break;
      case "statement_assign":
      case "statement_augmentedassign":
        collectExpr(stmt.path);
        collectExpr(stmt.expression);
        break;
      case "statement_return":
        if (stmt.expression) collectExpr(stmt.expression);
        break;
      case "statement_expression":
        collectExpr(stmt.expression);
        break;
      default:
        break;
    }

    return gen;
  }

  private collectKillExpressions(stmt: AstStatement): Set<AstExpression> {
    const kill = new Set<AstExpression>();

    const collectKilledVars = (expr: AstExpression) => {
      foldExpressions(expr, kill, (acc, expr) => {
        if (!this.has(acc, expr)) acc.add(expr);
        return acc;
      });
    };

    switch (stmt.kind) {
      case "statement_assign":
      case "statement_augmentedassign":
        collectKilledVars(stmt.path);
        break;
      case "statement_foreach":
        if (!this.has(kill, stmt.keyName)) kill.add(stmt.keyName);
        if (!this.has(kill, stmt.valueName)) kill.add(stmt.valueName);
        break;
      default:
        break;
    }

    return kill;
  }

  private anyReliesOn(
    exprs: AstExpression[],
    candidate: AstExpression,
  ): boolean {
    let result = false;
    exprs.forEach((expr) => {
      if (this.reliesOn(expr, candidate)) result = true;
    });
    return result;
  }

  private anyFieldReliesOn(
    exprs: AstStructFieldInitializer[],
    candidate: AstExpression,
  ): boolean {
    let result = false;
    exprs.forEach((expr) => {
      if (
        this.reliesOn(expr.field, candidate) ||
        this.reliesOn(expr.initializer, candidate)
      )
        result = true;
    });
    return result;
  }

  private equalArrayExpressions(
    expr1: AstExpression[],
    expr2: AstExpression[],
  ): boolean {
    if (expr1.length != expr2.length) return false;
    const i = 0;
    while (i < expr1.length) {
      if (!this.equalExpressions(expr1[i], expr2[i])) return false;
    }
    return true;
  }

  private equalFieldArrayExpressions(
    expr1: AstStructFieldInitializer[],
    expr2: AstStructFieldInitializer[],
  ): boolean {
    if (expr1.length != expr2.length) return false;
    const i = 0;
    while (i < expr1.length) {
      if (!this.equalExpressions(expr1[i].field, expr2[i].field)) return false;
      if (!this.equalExpressions(expr1[i].initializer, expr2[i].initializer))
        return false;
    }
    return true;
  }

  private equalExpressions(
    expr1: AstExpression,
    expr2: AstExpression,
  ): boolean {
    if (expr1.kind != expr2.kind) return false;
    switch (expr1.kind) {
      case "op_binary":
        if (expr2.kind === "op_binary")
          return (
            expr1.op === expr2.op &&
            this.equalExpressions(expr1.left, expr2.left) &&
            this.equalExpressions(expr1.left, expr2.left)
          );
        else return false;
      case "op_unary":
        if (expr2.kind === "op_unary")
          return (
            expr1.op === expr2.op &&
            this.equalExpressions(expr1.operand, expr2.operand)
          );
        else return false;
      case "string":
        if (expr2.kind === "string") return expr1.value === expr2.value;
        else return false;
      case "number":
        if (expr2.kind === "number")
          return expr1.value === expr2.value && expr1.base === expr2.base;
        else return false;
      case "boolean":
        if (expr2.kind === "boolean") return expr1.value === expr2.value;
        else return false;
      case "field_access":
        if (expr2.kind === "field_access")
          return (
            this.equalExpressions(expr1.aggregate, expr2.aggregate) &&
            this.equalExpressions(expr1.field, expr2.field)
          );
        else return false;
      case "id":
        if (expr2.kind === "id") return expr1.text === expr2.text;
        else return false;
      case "method_call":
        if (expr2.kind === "method_call")
          return (
            this.equalExpressions(expr1.self, expr2.self) &&
            this.equalExpressions(expr1.method, expr2.method) &&
            this.equalArrayExpressions(expr1.args, expr2.args)
          );
        else return false;
      case "static_call":
        if (expr2.kind === "static_call")
          return (
            this.equalExpressions(expr1.function, expr2.function) &&
            this.equalArrayExpressions(expr1.args, expr2.args)
          );
        else return false;
      case "struct_instance":
        if (expr2.kind === "struct_instance")
          return (
            this.equalExpressions(expr1.type, expr2.type) &&
            this.equalFieldArrayExpressions(expr1.args, expr2.args)
          );
        else return false;
      case "null":
        return true;
      case "init_of":
        if (expr2.kind === "init_of")
          return (
            this.equalExpressions(expr1.contract, expr2.contract) &&
            this.equalArrayExpressions(expr1.args, expr2.args)
          );
        else return false;
      case "conditional":
        if (expr2.kind === "conditional")
          return (
            this.equalExpressions(expr1.condition, expr2.condition) &&
            this.equalExpressions(expr1.thenBranch, expr2.thenBranch) &&
            this.equalExpressions(expr1.elseBranch, expr2.elseBranch)
          );
        else return false;
    }
  }

  private reliesOn(expr1: AstExpression, expr2: AstExpression): boolean {
    if (this.equalExpressions(expr1, expr2)) {
      const res = true;
      return res;
    }
    switch (expr1.kind) {
      case "op_binary":
        const res2 =
          this.reliesOn(expr1.left, expr2) || this.reliesOn(expr1.right, expr2);
        return res2;
      case "op_unary":
        const res3 = this.reliesOn(expr1.operand, expr2);
        return res3;
      case "string":
        const res4 = false;
        return res4;
      case "number":
        const res5 = false;
        return res5;
      case "boolean":
        const res6 = false;
        return res6;
      case "field_access":
        const res7 =
          this.reliesOn(expr1.aggregate, expr2) ||
          this.reliesOn(expr1.field, expr2);
        return res7;
      case "id":
        const res8 = false;
        return res8;
      case "method_call":
        const res9 =
          this.reliesOn(expr1.self, expr2) ||
          this.reliesOn(expr1.method, expr2) ||
          this.anyReliesOn(expr1.args, expr2);
        return res9;
      case "static_call":
        const res10 =
          this.reliesOn(expr1.function, expr2) ||
          this.anyReliesOn(expr1.args, expr2);
        return res10;
      case "struct_instance":
        const res11 =
          this.reliesOn(expr1.type, expr2) ||
          this.anyFieldReliesOn(expr1.args, expr2);
        return res11;
      case "null":
        const res12 = false;
        return res12;
      case "init_of":
        const res13 =
          this.reliesOn(expr1.contract, expr2) ||
          this.anyReliesOn(expr1.args, expr2);
        return res13;
      case "conditional":
        const res14 =
          this.reliesOn(expr1.condition, expr2) ||
          this.reliesOn(expr1.thenBranch, expr2) ||
          this.reliesOn(expr1.elseBranch, expr2);
        return res14;
    }
  }

  private has(set: Set<AstExpression>, expr: AstExpression): boolean {
    let isThere = false;
    set.forEach((e) => {
      if (this.equalExpressions(e, expr)) isThere = true;
    });
    return isThere;
  }

  private reliesOnAny(expr: AstExpression, set: Set<AstExpression>): boolean {
    let flag = false;
    set.forEach((e) => {
      if (this.reliesOn(expr, e)) flag = true;
    });
    return flag;
  }

  private updateKillExpressions(
    killed: Set<AstExpression>,
    inB: Set<AstExpression>,
  ): Set<AstExpression> {
    const kill = new Set<AstExpression>(killed);

    inB.forEach((inExpr) => {
      if (this.reliesOnAny(inExpr, kill)) {
        if (!this.has(kill, inExpr)) kill.add(inExpr);
      }
    });

    return kill;
  }
}
