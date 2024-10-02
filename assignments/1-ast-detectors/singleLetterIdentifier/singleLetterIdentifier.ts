import { ASTDetector } from "@nowarp/misti/dist/src/detectors/detector";
import { CompilationUnit } from "@nowarp/misti/dist/src/internals/ir";
import {
  MistiTactWarning,
  Severity,
} from "@nowarp/misti/dist/src/internals/warnings";
import { forEachStatement } from "@nowarp/misti/dist/src/internals/tactASTUtil";
import { AstId } from "@tact-lang/compiler/dist/grammar/ast";

/**
 * This detector highlights the use of single-letter identifiers, including constants,
 * contract fields, function names and arguments, and local variables.
 *
 * ## Why is it bad?
 * Single-letter names are usually less readable and make code harder to understand.
 *
 * ## Example
 * ```tact
 * fun calculateFee(a: Int): Int {
 *   let f: Int = (a * 2) / 100;
 *   return f;
 * }
 * ```
 *
 * Use instead:
 * ```tact
 * fun calculateFee(amount: Int): Int {
 *   let fee: Int = (amount * 2) / 100;
 *   return fee;
 * }
 * ```
 */
export class SingleLetterIdentifier extends ASTDetector {
  warnings: MistiTactWarning[] = [];

  async check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    this.checkConstants(cu);
    this.checkFields(cu);
    this.checkFunctionArguments(cu);
    this.checkLocalVariables(cu);
    return this.warnings;
  }

  /**
   * Checks for single-letter constants in the compilation unit.
   */
  private checkConstants(cu: CompilationUnit): void {
    Array.from(cu.ast.getConstants()).forEach((constant) => {
      if (this.isSingleLetterId(constant.name)) {
        this.warnings.push(
          this.makeWarning(
            `Constant ${constant.name.text} should have a more meaningful name`,
            Severity.INFO,
            constant.loc,
          ),
        );
      }
    });
  }

  /**
   * Checks for single-letter fields of all the contracts defined in the compilation unit.
   */
  private checkFields(cu: CompilationUnit): void {
    Array.from(cu.ast.getContracts()).forEach((contract) => {
      cu.ast.getContractFields(contract.id)!.forEach((field) => {
        if (this.isSingleLetterId(field.name)) {
          this.warnings.push(
            this.makeWarning(
              `Field ${field.name.text} should have a more meaningful name`,
              Severity.INFO,
              field.loc,
            ),
          );
        }
      });
    });
  }
  /**
   * Checks for single-letter function names and arguments in the compilation unit.
   */
  private checkFunctionArguments(cu: CompilationUnit): void {
    Array.from(cu.ast.getFunctions()).forEach((fun) => {
      // XXX: We ignore asm functions, arguments of receiver and init function to don't complicate things.
      if (fun.kind === "function_def") {
        if (this.isSingleLetterId(fun.name)) {
          this.warnings.push(
            this.makeWarning(
              `Function ${fun.name.text} should have a more meaningful name`,
              Severity.INFO,
              fun.loc,
            ),
          );
        }
        fun.params.forEach((param) => {
          if (this.isSingleLetterId(param.name)) {
            this.warnings.push(
              this.makeWarning(
                `Function argument ${param.name.text} should have a more meaningful name`,
                Severity.INFO,
                param.loc,
              ),
            );
          }
        });
      }
    });
  }

  /**
   * Checks for single-letter local variables in the compilation unit.
   */
  private checkLocalVariables(cu: CompilationUnit): void {
    cu.ast.getProgramEntries().forEach((entry) => {
      forEachStatement(entry, (stmt) => {
        if (stmt.kind === "statement_let" && this.isSingleLetterId(stmt.name)) {
          this.warnings.push(
            this.makeWarning(
              `Local variable ${stmt.name.text} should have a more meaningful name`,
              Severity.INFO,
              stmt.loc,
            ),
          );
        }
      });
    });
  }

  private isSingleLetterId(id: AstId): boolean {
    return id.text.length === 1;
  }
}
