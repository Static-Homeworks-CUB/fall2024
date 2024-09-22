import { ASTDetector } from "@nowarp/misti/dist/src/detectors/detector";
import { CompilationUnit } from "@nowarp/misti/dist/src/internals/ir";
import {
  MistiTactWarning,
  Severity,
} from "@nowarp/misti/dist/src/internals/warnings";
import { forEachStatement } from "@nowarp/misti/dist/src/internals/tactASTUtil";

export class VarDetector extends ASTDetector {
  warnings: MistiTactWarning[] = [];

  async check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    this.checkLocalVariables(cu);
    return this.warnings;
  }

  private checkLocalVariables(cu: CompilationUnit): void {
    cu.ast.getProgramEntries().forEach((entry) => {
      forEachStatement(entry, (stmt) => {
        if (stmt.kind === "statement_let" && stmt.type == null) {
          this.warnings.push(
            this.makeWarning(
              `Local variable ${stmt.name.text} should have explicit type`,
              Severity.INFO,
              stmt.loc,
            ),
          );
        }
      });
    });
  }
}
