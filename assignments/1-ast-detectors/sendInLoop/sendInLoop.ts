import { ASTDetector } from "@nowarp/misti/dist/src/detectors/detector";
import { CompilationUnit } from "@nowarp/misti/dist/src/internals/ir";
import {
  MistiTactWarning,
  Severity,
} from "@nowarp/misti/dist/src/internals/warnings";
import {
  forEachExpression,
  forEachStatement,
} from "@nowarp/misti/dist/src/internals/tactASTUtil";
import {
  AstExpression,
  AstNode,
  AstStatement,
  AstStatementForEach,
  AstStatementRepeat,
  AstStatementUntil,
  AstStatementWhile,
} from "@tact-lang/compiler/dist/grammar/ast";

namespace AstHelpers {
  /**
   * Represents a loop statement in the AST.
   */
  export type AstStatementLoop =
    | AstStatementWhile
    | AstStatementUntil
    | AstStatementRepeat
    | AstStatementForEach;

  /**
   * Determines if a given statement is a loop statement.
   *
   * @param stmt - The statement to check.
   * @returns True if the statement is a loop statement, otherwise false.
   */
  export function isLoop(stmt: AstStatement): stmt is AstStatementLoop {
    return (
      stmt.kind === "statement_while" ||
      stmt.kind === "statement_until" ||
      stmt.kind === "statement_repeat" ||
      stmt.kind === "statement_foreach"
    );
  }

  /**
   * Iterates over each expression within loop statements in the given AST node.
   *
   * @param node - The AST node to traverse.
   * @param callback - A function to be called for each expression found within loop statements.
   */
  export function forEachExpressionInLoop(
    node: AstNode,
    callback: (expr: AstExpression, loop: AstStatementLoop) => void,
  ) {
    // Keep track of loop IDs to avoid processing the same loop multiple times.
    const seenLoopIds = new Set<number>();

    forEachStatement(node, (stmt) => {
      // We rely on fact that parent loop is always processed before its children.
      if (isLoop(stmt) && !seenLoopIds.has(stmt.id)) {
        // Mark all child loops as seen to avoid processing them again.
        forEachStatement(stmt, (stmt) => {
          if (isLoop(stmt)) {
            seenLoopIds.add(stmt.id);
          }
        });
        // Apply the callback to each expression within the loop.
        forEachExpression(stmt, (expr) => callback(expr, stmt));
      }
    });
  }
}

/**
 * This detector identifies the use of the `send` function within loops.
 *
 * ## Why is it bad?
 * Sending in a loop can cause the contract to run out of funds, as each iteration
 * of the loop may result in a transfer of funds, potentially depleting the contract's balance.
 *
 * ## Example
 * ```tact
 * repeat (10) {
 *     send(SendParameters{
 *         to: sender(),
 *         value: 0,
 *     });
 * }
 * ```
 */
export class SendInLoop extends ASTDetector {
  warnings: MistiTactWarning[] = [];

  async check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    for (const entry of cu.ast.getProgramEntries()) {
      AstHelpers.forEachExpressionInLoop(entry, (expr, loop) => {
        this.checkExpression(expr, loop);
      });
    }

    return this.warnings;
  }

  private checkExpression(
    expr: AstExpression,
    loop: AstHelpers.AstStatementLoop,
  ) {
    if (expr.kind === "static_call" && expr.function.text === "send") {
      // To report the least enclosing loop, it is better to write custom traversal logic.
      this.warnings.push(
        this.makeWarning(
          "Sending in a loop can cause the contract to run out of funds.\n" +
            `Enclosing loop: ${loop.loc.interval.getLineAndColumnMessage()}`,
          Severity.INFO,
          expr.loc,
        ),
      );
    }
  }
}
