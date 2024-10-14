import { ASTDetector } from "@nowarp/misti/dist/src/detectors/detector";
import {
  MistiTactWarning,
  Severity,
} from "@nowarp/misti/dist/src/internals/warnings";
import { CompilationUnit } from "@nowarp/misti/dist/src/internals/ir";
import {
  AstExpression,
  AstId,
  AstStatement,
  AstStatementUntil,
  AstStatementWhile,
} from "@tact-lang/compiler/dist/grammar/ast";
import {
  foldExpressions,
  foldStatements,
  forEachExpression,
} from "@nowarp/misti/dist/src/internals/tactASTUtil";

/**
 * Report loops (AstStatementWhile and AstStatementUntil) that don't use the loop variable.
 * For implementation simplification, "use" means either read or write in the loop body.
 *
 * Example
 * let a: Int = 0;
 * while (a < 10) { // Loop variable 'a' is not used in the loop body.
 *   self.do_something();
 * }
 * Use instead:
 *
 * let a: Int = 0;
 * while (a < 10) {
 *   self.do_something();
 *   a += 1;
 * }
 */
export class UnusedLoopVariable extends ASTDetector {
  warnings: MistiTactWarning[] = [];

  async check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    this.checkLoopStatements(cu);
    return this.warnings;
  }

  /**
   * Traverse loop statements of the compilation unit for unused variable check.
   */
  private checkLoopStatements(cu: CompilationUnit) {
    Array.from(cu.ast.getStatements()).forEach((statement) => {
      if (
        statement.kind == "statement_while" ||
        statement.kind == "statement_until"
      ) {
        this.checkLoopStatementWithVariableInCondition(statement);
      }
    });
  }

  /**
   * Check if the given loop statement accesses a field in the condition expression,
   * and produce a warning if this variable is not accessed anywhere in the loop body.
   */
  private checkLoopStatementWithVariableInCondition(
    statement: AstStatementWhile | AstStatementUntil,
  ) {
    const usedVariables: AstId[] = [];

    forEachExpression(statement.condition, (expression) => {
      if (expression.kind == "id") {
        usedVariables.push(expression);
      }
    });

    if (usedVariables.length == 0) return;

    const isAnyVariableUsed = usedVariables.find((varId) =>
      this.isVariableUsedInLoop(varId, statement),
    );
    if (!isAnyVariableUsed && isAnyVariableUsed == undefined) {
      this.warnings.push(
        this.makeWarning(
          `Loop variables '${usedVariables.reduce((text, variable) => text + variable.text + " ", "").trimEnd()}' are not accessed in the loop body.`,
          Severity.INFO,
          statement.loc,
        ),
      );
    }
  }

  private isVariableUsedInLoop(
    variable: AstId,
    statement: AstStatementWhile | AstStatementUntil,
  ): boolean {
    const variableUsagesInStatements = foldStatements(
      statement,
      false,
      (acc, subStatement) => {
        return acc || this.isVariableUsedInStatement(variable, subStatement);
      },
    );

    const statementWhereVariableIsUsed = statement.statements.find(
      (subStatement) =>
        foldExpressions(subStatement, false, (acc, subExpression) => {
          return (
            acc || this.isVariableUsedInExpression(variable, subExpression)
          );
        }),
    );

    return (
      variableUsagesInStatements || statementWhereVariableIsUsed != undefined
    );
  }

  /**
   * For a given statement and a variable identifier, determine if such a variable is used in the statement.
   */
  private isVariableUsedInStatement(
    variableId: AstId,
    statement: AstStatement,
  ): boolean {
    switch (statement.kind) {
      case "statement_assign": {
        return statement.path == variableId;
      }
      case "statement_augmentedassign": {
        return statement.path == variableId;
      }
      default:
    }
    return false;
  }

  /**
   * For a given expression and a variable identifier, determine if such a variable is used in the expression.
   */
  private isVariableUsedInExpression(
    variableId: AstId,
    expression: AstExpression,
  ): boolean {
    switch (expression.kind) {
      case "field_access": {
        return expression.field.text == variableId.text;
      }
      case "id": {
        return expression.text == variableId.text;
      }
      default:
    }
    return false;
  }
}
