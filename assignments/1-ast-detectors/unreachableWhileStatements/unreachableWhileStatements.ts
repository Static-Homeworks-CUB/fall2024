import { ASTDetector } from "@nowarp/misti/dist/src/detectors/detector";
import { CompilationUnit } from "@nowarp/misti/dist/src/internals/ir";
import {
  MistiTactWarning,
  Severity,
} from "@nowarp/misti/dist/src/internals/warnings";
import { forEachStatement } from "@nowarp/misti/dist/src/internals/tactASTUtil";
import {
  AstBoolean,
  AstStatementWhile,
} from "@tact-lang/compiler/dist/grammar/ast";

/**
 * This detector highlights the unreachable while statements.
 *
 * ## Why is it bad?
 * Unreachable while statements are similar to dead code.
 * These statements exist, but never are executed
 *
 * ## Example
 * ```tact
 * while (false) {} // OK: No statements in the body
 * while (false) { self.do_something(); } // Bad
 * ```
 *
 * Use instead:
 * ```tact
 * while (false) {} // OK: No statements in the body
 * while (a > 5) { self.do_something(); } // OK: The condition is fixed
 * }
 * ```
 */
export class UnreachableWhileStatements extends ASTDetector {
  warnings: MistiTactWarning[] = [];

  /**
   * Recursively checks unreachable code in while statements
   */
  async check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    cu.ast.getProgramEntries().forEach((entry) => {
      forEachStatement(entry, (stmt) => {
        if (
          stmt.kind === "statement_while" &&
          this.unreachableWhileUsage(stmt)
        ) {
          this.warnings.push(
            this.makeWarning(
              "While statement is not reachable",
              Severity.INFO,
              stmt.loc,
            ),
          );
        }
      });
    });
    return this.warnings;
  }

  /**
   * For while statement define if it contains unreachable code
   */
  private unreachableWhileUsage(stmt: AstStatementWhile): boolean {
    if (stmt.condition.kind !== "boolean") return false;

    return !(stmt.condition as AstBoolean).value && stmt.statements.length != 0;
  }
}
