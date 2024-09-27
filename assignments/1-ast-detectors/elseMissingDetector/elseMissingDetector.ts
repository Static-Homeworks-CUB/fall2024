import { ASTDetector } from "@nowarp/misti/dist/src/detectors/detector";
import { CompilationUnit } from "@nowarp/misti/dist/src/internals/ir";
import {
  MistiTactWarning,
  Severity,
} from "@nowarp/misti/dist/src/internals/warnings";
import { forEachStatement } from "@nowarp/misti/dist/src/internals/tactASTUtil";
import { AstCondition } from "@tact-lang/compiler/dist/grammar/ast";

/**
 * This detector checks for conditional statements that include `else if` clauses but lack a final `else` clause.
 *
 * ## Why is it bad?
 * A missing `else` statement makes the source code less readable and may lead to unhandled cases. Therefore, it is recommended to always include it.
 *
 * ## Example
 * ```tact
 * if (a > 5) {  ... }
 * else if (a < 2) {  ...  }
 * // Bad: Missing else
 * ```
 *
 * Use instead:
 * ```tact
 * if (a > 5) {  ...  }
 * else if (a < 2) {  ...  }
 * else {  ...  }
 * ```
 */
export class MissingElseDetector extends ASTDetector {
  warnings: MistiTactWarning[] = [];

  async check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    this.checkConditionStatements(cu);
    return this.warnings;
  }

  /**
   * Checks for conditional statements with `else if` clauses but missing a final `else` clause.
   */
  private checkConditionStatements(cu: CompilationUnit): void {
    cu.ast.getProgramEntries().forEach((entry) => {
      forEachStatement(entry, (stmt) => {
        if (stmt.kind === "statement_condition") {
          this.checkConditionStatement(stmt as AstCondition);
        }
      });
    });
  }

  /**
   * Recursively checks a conditional statement for missing `else` clause after `else if` clauses.
   */
  private checkConditionStatement(condStmt: AstCondition): void {
    if (condStmt.elseif !== null && condStmt.elseif.falseStatements === null) {
      this.warnings.push(
        this.makeWarning(
          "Conditional statement with 'else if' clauses should end with an 'else' clause",
          Severity.INFO,
          condStmt.loc,
        ),
      );
    }

    // Recursively check all else-if branches
    if (condStmt.elseif !== null) {
      this.checkConditionStatement(condStmt.elseif);
    }
  }
}
