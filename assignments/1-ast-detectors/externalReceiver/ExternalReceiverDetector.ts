import { ASTDetector } from "@nowarp/misti/dist/src/detectors/detector";
import { CompilationUnit } from "@nowarp/misti/dist/src/internals/ir";
import {
  MistiTactWarning,
  Severity,
} from "@nowarp/misti/dist/src/internals/warnings";
import { AstReceiver } from "@tact-lang/compiler/dist/grammar/ast";

export class ExternalReceiverDetector extends ASTDetector {
  warnings: MistiTactWarning[] = [];

  async check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    this.checkExternals(cu);
    return this.warnings;
  }

  private checkExternals(cu: CompilationUnit): void {
    const contracts = Array.from(cu.ast.getContracts());
    const receivers = contracts.flatMap((contract) =>
      contract.declarations.filter((decl) => decl.kind == "receiver"),
    ) as AstReceiver[];
    for (const receiver of receivers) {
      const externalReceiverSelectorKinds = [
        "external-simple",
        "external-fallback",
        "external-comment",
      ];
      if (externalReceiverSelectorKinds.includes(receiver.selector.kind)) {
        this.warnings.push(
          this.makeWarning(
            `Using an external receiver`,
            Severity.INFO,
            receiver.loc,
          ),
        );
      }
    }
  }
}
