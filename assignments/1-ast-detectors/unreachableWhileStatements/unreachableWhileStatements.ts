import { ASTDetector } from "@nowarp/misti/dist/src/detectors/detector";
import { CompilationUnit } from "@nowarp/misti/dist/src/internals/ir";
import {
  MistiTactWarning,
  Severity,
} from "@nowarp/misti/dist/src/internals/warnings";
import { forEachStatement } from "@nowarp/misti/dist/src/internals/tactASTUtil";
import {
  AstBoolean,
  AstCondition,
  AstId,
  AstStatementWhile,
} from "@tact-lang/compiler/dist/grammar/ast";

/**
 * This detector highlights the use of single-letter identifiers, including constants,
 * contract fields, function names and arguments, and local variables.
 *
 * ## Why is it bad?
 * Single-letter names are usually less readable and make code harder to understand.
 *
 * ## Example
 * ```tact
 * fun calculateFee(a: Int): Int {
 *   let f: Int = (a * 2) / 100;
 *   return f;
 * }
 * ```
 *
 * Use instead:
 * ```tact
 * fun calculateFee(amount: Int): Int {
 *   let fee: Int = (amount * 2) / 100;
 *   return fee;
 * }
 * ```
 */
export class UnreachableWhileStatements extends ASTDetector {
  warnings: MistiTactWarning[] = [];

  async check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    cu.ast.getProgramEntries().forEach((entry) => {
      forEachStatement(entry, (stmt) => {
        if (stmt.kind === "statement_while") {
          if (this.whileCheck(stmt)) {
            this.warnings.push(
              this.makeWarning(
                "While statement is not reachable",
                Severity.INFO,
                stmt.loc,
              ),
            );
          }
        }
      });
    });
    return this.warnings;
  }

  private whileCheck(stmt: AstStatementWhile): boolean {
    return (
      (stmt.condition as AstBoolean).value == false &&
      stmt.statements.length != 0
    );
  }
}
