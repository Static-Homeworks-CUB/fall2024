import { ASTDetector } from "@nowarp/misti/dist/src/detectors/detector";
import { CompilationUnit } from "@nowarp/misti/dist/src/internals/ir";
import { MistiTactWarning, Severity } from "@nowarp/misti/dist/src/internals/warnings";
import { forEachExpression } from "@nowarp/misti/dist/src/internals/tactASTUtil";
import { AstExpression } from "@tact-lang/compiler/dist/grammar/ast";

export class SendInLoop extends ASTDetector {
  warnings: MistiTactWarning[] = [];

  async check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    for (const stmt of cu.ast.getStatements()) {
      switch (stmt.kind) {
        case 'statement_while':
        case 'statement_until':
        case 'statement_repeat':
        case 'statement_foreach':
          forEachExpression(stmt, (expr) => this.checkExpression(expr));
          break;
        default:
          break;
      }
    }
    return this.warnings;
  }

  private checkExpression(expr: AstExpression) {
    if (expr.kind === "static_call" && expr.function.text === "send") {
      this.warnings.push(
        this.makeWarning(
          `Sending in a loop can cause the contract to run out of funds.`,
          Severity.INFO,
          expr.loc,
        ),
      );
    }
  }
}
