import { ASTDetector } from "@nowarp/misti/dist/src/detectors/detector";
import { CompilationUnit } from "@nowarp/misti/dist/src/internals/ir";
import {
  MistiTactWarning,
  Severity,
} from "@nowarp/misti/dist/src/internals/warnings";
import { forEachStatement } from "@nowarp/misti/dist/src/internals/tactASTUtil";
import { AstCondition } from "@tact-lang/compiler/dist/grammar/ast";


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
    const hasElseIf = condStmt.elseif != null;
    const hasElse =
      condStmt.falseStatements != null;

    if (hasElseIf && !hasElse) {
      this.warnings.push(
        this.makeWarning(
          "Conditional statement with 'else if' clauses should end with an 'else' clause",
          Severity.INFO,
          condStmt.loc
        )
      );
    }

    // Recursively check all else-if branches
    if (condStmt.elseif!=null) {
        this.checkConditionStatement(condStmt.elseif);
    }
  }
}
