import { ASTDetector } from "@nowarp/misti/dist/src/detectors/detector";
import { CompilationUnit } from "@nowarp/misti/dist/src/internals/ir";
import {
  MistiTactWarning,
  Severity,
} from "@nowarp/misti/dist/src/internals/warnings";
import { AstExpression } from "@tact-lang/compiler/dist/grammar/ast";

import { AstStatementLoop, forEachExpressionInLoop } from "../../utils/loops";

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
 *         value: 100,
 *     });
 * }
 * ```
 */
export class SendInLoop extends ASTDetector {
  warnings: MistiTactWarning[] = [];

  async check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    for (const entry of cu.ast.getProgramEntries()) {
      forEachExpressionInLoop(entry, (expr, loop) => {
        this.checkExpression(expr, loop);
      });
    }

    return this.warnings;
  }

  private checkExpression(expr: AstExpression, loop: AstStatementLoop) {
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
