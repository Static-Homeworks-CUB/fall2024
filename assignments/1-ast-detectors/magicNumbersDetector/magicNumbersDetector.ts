import { ASTDetector } from "@nowarp/misti/dist/src/detectors/detector";
import { CompilationUnit } from "@nowarp/misti/dist/src/internals/ir";
import {
  MistiTactWarning,
  Severity,
} from "@nowarp/misti/dist/src/internals/warnings";
import { forEachStatement } from "@nowarp/misti/dist/src/internals/tactASTUtil";
import {
  AstExpression,
  AstStatement,
} from "@tact-lang/compiler/dist/grammar/ast";

/**
 * This detector checks for magic numbers in the source code.
 *
 * ## Why is it bad?
 * Magic numbers make code unclear and harder to maintain. Use named constants for better readability.
 *
 * ## Example
 * ```
 * let a: Int = (1000 * 2) + 1;
 * ```
 * Use instead:
 * ```
 * const DEFAULT_AMOUNT: Int = 1000;
 * const BLOCK_REWARD_MULTIPLIER: Int = 2;
 * const BLOCK_CONFIRMATION_COUNT: Int = 1;
 *
 * let a: Int = (DEFAULT_AMOUNT * BLOCK_REWARD_MULTIPLIER) + BLOCK_CONFIRMATION_COUNT;
 * ```
 */
export class MagicNumbersDetector extends ASTDetector {
  static readonly ALLOWED_MAGIC_NUMBERS = [BigInt(1), BigInt(-1)];

  warnings: MistiTactWarning[] = [];

  async check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    this.checkNumericLiterals(cu);
    return this.warnings;
  }

  /**
   * Checks for numeric literals (magic numbers) in the code.
   */
  private checkNumericLiterals(cu: CompilationUnit): void {
    cu.ast.getProgramEntries().forEach((entry) => {
      forEachStatement(entry, (stmt) => {
        // console.log(`Found statement: ${stmt.kind}`);
        // if (stmt.kind === "statement_expression") {
        //   console.log(` Expression kind: ${stmt.expression.kind}`);
        //   if (stmt.expression.kind === "op_binary") {
        //     const expr = stmt.expression as AstOpBinary;
        //     console.log(
        //       ` Bin op: ${expr.left.kind} ${expr.op} ${expr.right.kind}`,
        //     );
        //   }
        // }

        this.checkForMagicNumberInStatement(stmt);
      });
    });
  }

  /**
   * Checks for numeric literals in the statement.
   */
  private checkForMagicNumber(expr: AstExpression): void {
    if (expr.kind === "op_unary") {
      this.checkForMagicNumber(expr.operand);
    } else if (expr.kind === "method_call") {
      expr.args.forEach((arg) => {
        this.checkForMagicNumber(arg);
      });
    } else if (expr.kind === "static_call") {
      expr.args.forEach((arg) => {
        this.checkForMagicNumber(arg);
      });
    } else if (expr.kind === "op_binary") {
      // console.log(`Found expression: ${expr.left} ${expr.op} ${expr.right}`);
      [expr.left, expr.right].forEach((arg) => {
        if (
          arg.kind === "number" &&
          !MagicNumbersDetector.ALLOWED_MAGIC_NUMBERS.includes(arg.value)
        ) {
          this.warnings.push(
            this.makeWarning(
              `Magic number detected: ${arg.value}. Consider replacing it with a named constant`,
              Severity.INFO,
              expr.loc,
            ),
          );
        } else if (arg.kind === "op_binary") {
          this.checkForMagicNumber(arg);
        }
      });
    }
  }

  private checkForMagicNumberInStatement(stmt: AstStatement): void {
    switch (stmt.kind) {
      case "statement_let":
        this.checkForMagicNumber(stmt.expression);
      case "statement_expression":
        this.checkForMagicNumber(stmt.expression);
      case "statement_assign":
        this.checkForMagicNumber(stmt.expression);
      case "statement_augmentedassign":
        this.checkForMagicNumber(stmt.expression);
      case "statement_return":
        if (stmt.expression) this.checkForMagicNumber(stmt.expression);
      // TODO
      case "statement_condition": {
      }
      case "statement_while": {
      }
      case "statement_until": {
      }
      case "statement_repeat": {
      }
      case "statement_try": {
      }
      case "statement_try_catch": {
      }
      case "statement_foreach": {
      }
    }
  }
}
