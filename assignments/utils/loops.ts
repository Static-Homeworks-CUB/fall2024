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
