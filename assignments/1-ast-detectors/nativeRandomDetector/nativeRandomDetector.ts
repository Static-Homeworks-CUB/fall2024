import { ASTDetector } from "@nowarp/misti/dist/src/detectors/detector";
import { CompilationUnit } from "@nowarp/misti/dist/src/internals/ir";
import {
  MistiTactWarning,
  Severity,
} from "@nowarp/misti/dist/src/internals/warnings";
import { forEachExpression } from "@nowarp/misti/dist/src/internals/tactASTUtil";
import { AstExpression } from "@tact-lang/compiler/dist/grammar/ast";

/**
 * This detector highlights the nativeRandom function calls
 *
 * ## Why is it bad?
 * nativeRandom is a random generation function that requires prior random generator initialization. Therefore, it is suggested to use randomInt instead.
 *
 * ## Example
 * ```tact
 * fun randNum() {
 *   return nativeRandom();
 * }
 * ```
 *
 * Use instead:
 * ```tact
 * fun randNum() {
 *   return randomInt();
 * }
 * ```
 */

export class NativeRandomDetector extends ASTDetector {
  warnings: MistiTactWarning[] = [];

  async check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    Array.from(cu.ast.getProgramEntries()).forEach((node) => {
      forEachExpression(node, (expr) => {
        this.checkExpression(expr);
      });
    });
    return this.warnings;
  }

  /**
   * Checks if AST expression is a `nativeRandom` function call.
   */
  private checkExpression(expr: AstExpression): void {
    if (expr.kind === "static_call") {
      if (expr.function.text === "nativeRandom") {
        this.warnings.push(
          this.makeWarning(
            `Function nativeRandom requires prior random generator initialization. Consider using randomInt instead`,
            Severity.INFO,
            expr.loc,
          ),
        );
      }
    }
  }
}
