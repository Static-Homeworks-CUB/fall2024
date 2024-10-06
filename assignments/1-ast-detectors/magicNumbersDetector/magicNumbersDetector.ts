import { ASTDetector } from "@nowarp/misti/dist/src/detectors/detector";
import { CompilationUnit } from "@nowarp/misti/dist/src/internals/ir";
import {
  MistiTactWarning,
  Severity,
} from "@nowarp/misti/dist/src/internals/warnings";
import { forEachExpression } from "@nowarp/misti/dist/src/internals/tactASTUtil";
import { AstExpression } from "@tact-lang/compiler/dist/grammar/ast";

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
  static readonly ALLOWED_MAGIC_NUMBERS = [BigInt(0), BigInt(1), BigInt(-1)];

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
      forEachExpression(entry, (expr) => {
        this.checkForMagicNumber(expr);
      });
    });
  }

  /**
   * Checks for numeric literals in the statement.
   */
  private checkForMagicNumber(expr: AstExpression): void {
    if (expr.kind === "op_binary") {
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
        }
      });
    }
  }
}
