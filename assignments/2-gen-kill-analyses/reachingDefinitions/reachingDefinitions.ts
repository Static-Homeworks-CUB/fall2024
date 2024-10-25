import { DataflowDetector } from "@nowarp/misti/dist/src/detectors/detector";
import {
  CFG,
  CompilationUnit,
  TactASTStore,
} from "@nowarp/misti/dist/src/internals/ir";
import { MistiTactWarning } from "@nowarp/misti/dist/src/internals/warnings";
import {
  AstExpression,
  AstStatement,
} from "@tact-lang/compiler/dist/grammar/ast";

type Definition = string;

type VarName = string;

type ListOfDefinitions = Array<Definition>;

type VarNameWithDefinitions = [VarName, ListOfDefinitions];

type MapOfVarsToDefinitions = Map<VarName, ListOfDefinitions>;


// export DIR=assignments/2-gen-kill-analyses/reachingDefinitions
// yarn misti --detectors $DIR/reachingDefinitions.ts:ReachingDefinitions $DIR/contract.tact

export class ReachingDefinitions extends DataflowDetector {
  async check(cu: CompilationUnit): Promise<MistiTactWarning[]> {
    const listOfReports: Array<string> = [];

    cu.forEachCFG(cu.ast, (cfg) => {
      if (cfg.origin === "user") {
        this.reachingDefinitionAnalysis(cfg, cu.ast).forEach((item) => {
          listOfReports.push(item);
        });
      }
    });

    console.log(listOfReports.join("\n"));
    return Promise.resolve([]);
  }

  private getListOfDefinitions(
    astExpression: AstExpression,
  ): ListOfDefinitions {
    switch (astExpression.kind) {
      case "string":
        return [astExpression.value];
      case "number":
      case "boolean":
        return [String(astExpression.value)];
      case "null":
        return ["null"];
      case "conditional":
        // В случае если мы используем if-else statement, то это отображается в Control Flow Graph.
        // Если if else expression -- то в Control Flow Graph попадает только присвоение (моё предположение...)
        // По-хорошему, if-else expression нужно преобразовывать в if-else statement
        // И учитывать в Control Flow Graph отдельно, чтобы строить точнее reaching definitions
        return this.getListOfDefinitions(astExpression.thenBranch).concat(
          this.getListOfDefinitions(astExpression.elseBranch),
        );
      case "field_access":
        return [`field value ${astExpression.field.text}`];
      case "op_binary":
        const leftDefinitions = this.getListOfDefinitions(astExpression.left);
        const rightDefinitions = this.getListOfDefinitions(astExpression.right);

        const listOfAllDefinitions = [];

        // Декартово произведение, так как слева в операнде может быть n определений
        // В правом операнде m определений
        // Соответственно, у нас может быть n * m возможных определений
        for (const def1 of leftDefinitions) {
          for (const def2 of rightDefinitions) {
            listOfAllDefinitions.push(`${def1} ${astExpression.op} ${def2}`);
          }
        }

        return listOfAllDefinitions;
      case "op_unary":
        const listOfDefinitions = [];
        const definitions = this.getListOfDefinitions(astExpression.operand);

        for (const def of definitions) {
          listOfDefinitions.push(` ${astExpression.op} ${def}`);
        }

        return listOfDefinitions;
      case "method_call":
        return [
          `${astExpression.method.text} (${astExpression.args.join(", ")})`,
        ];
      case "id":
        return [astExpression.text];
      case "static_call":
        throw new Error('Not supported: "static_call" case');
      case "struct_instance":
        throw new Error('Not supported: "struct_instance" case');
      case "init_of":
        throw new Error('Not supported: "init_of" case');
    }
  }

  private getGENSetByAstStatement(
    astStatement: AstStatement,
  ): VarNameWithDefinitions | null {
    switch (astStatement.kind) {
      case "statement_let":
        const varName = astStatement.name.text;
        const definitions = this.getListOfDefinitions(astStatement.expression);

        return [varName, definitions];
      default:
        return null;
    }
  }

  private getKILLSetByAstStatement(astStatement: AstStatement): VarName | null {
    switch (astStatement.kind) {
      case "statement_augmentedassign":
      case "statement_assign":
        if (astStatement.path.kind === "id") {
          return astStatement.path.text;
        }

        return null;
      default:
        return null;
    }
  }

  reachingDefinitionAnalysis(cfg: CFG, ast: TactASTStore): Array<string> {
    // Map AST Statement Id к:
    //                    (Имя переменной, список из определений)
    const astIdToGENSet = new Map<number, VarNameWithDefinitions | null>();
    // Map AST Statement Id к имени переменной, которая была переопределена (= убита)
    const astIdToKILLSet = new Map<number, VarName | null>();


    cfg.nodes.forEach((block) => {
      const astStatement = ast.getStatement(block.stmtID);

      if (!astStatement) throw Error(`Internal Error. AST Statement with id ${block.stmtID} is not available.`);

      const genResult = this.getGENSetByAstStatement(astStatement);
      const killResult = this.getKILLSetByAstStatement(astStatement);

      astIdToGENSet.set(
        block.stmtID,
        genResult
      );
      astIdToKILLSet.set(
        block.stmtID,
        killResult
      );
    });

    // Все определения для инициализации итеративного алгоритма
    // Должны получить структуру: Var -> Defs
    // Склеиваем все элементы по VarName
    const allDefinitions: MapOfVarsToDefinitions = Array.from(
      astIdToGENSet.values(),
    ).reduce((acc, defs) => {
      if (!defs) return acc;

      const [varName, varDefs] = defs

      const alreadyFoundVarsToDefs = new Map(acc);

      const alreadyFoundDefinitionsToVar = alreadyFoundVarsToDefs.get(varName)
      if (!alreadyFoundDefinitionsToVar) {
        // Нет такой переменной ещё
        alreadyFoundVarsToDefs.set(varName, varDefs);
      } else {
        // Уже есть, конкатенируем уже существующие определения с текущими
        // Не забываем про уникальность definitions (они не должны повторяться)
        alreadyFoundVarsToDefs.set(varName, [...new Set([...alreadyFoundDefinitionsToVar, ...varDefs])]);
      }

      return alreadyFoundVarsToDefs;
    }, new Map<VarName, ListOfDefinitions>());


    const reachesSteps = new Array<Map<number, MapOfVarsToDefinitions>>();

    const initializationStep: Map<number, MapOfVarsToDefinitions> = new Map();

    cfg.nodes.forEach((block) => {
      initializationStep.set(block.stmtID, allDefinitions);
    });

    reachesSteps.push(initializationStep);


    while (true) {
      const reachesStep = new Map(
        reachesSteps.at(reachesSteps.length - 1),
      );

      cfg.nodes.forEach((block) => {
        const reachesNew = new Map<VarName, ListOfDefinitions>();

        cfg.getPredecessors(block.idx)?.forEach((predecessor) => {
          const gen = astIdToGENSet.get(predecessor.stmtID);
          const kill = astIdToKILLSet.get(predecessor.stmtID);

          // Добавляем новую переменную и её defs
          if (gen) {
            const [genVarName, genVarDefs] = gen

            const reachesNewDefinitions = reachesNew.get(genVarName)
            if (reachesNewDefinitions) {
              reachesNew.set(genVarName, [...new Set([...genVarDefs, ...reachesNewDefinitions])]);
            } else {
              reachesNew.set(genVarName, genVarDefs);
            }
          }

          // Получаем самые актуальные (не новые) Reaches для predecessor
          const reachesCurrent = reachesSteps
            .at(reachesSteps.length - 1)
            ?.get(predecessor.stmtID);

          if (!reachesCurrent) {
            throw new Error(
              `Internal Error. No such element with id ${predecessor.stmtID} in reachesOld`,
            );
          }

          for (const [varName, varDefs] of reachesCurrent) {
            if (kill === varName) {
              continue;
            } else {
              // Проверяем, вдруг уже добавили (с помощью GEN сета, или других predecessor)
              const alreadyExist = reachesNew.get(varName)

              if (alreadyExist) {
                reachesNew.set(varName, [
                  ...new Set([...alreadyExist, ...varDefs])
                ])
              } else {
                reachesNew.set(varName, varDefs);
              }
            }
          }
        });

        // Добавляем новые, досчитанные значения для block
        // Эти значения были подсчитаны на predecessors у block
        reachesStep.set(block.stmtID, reachesNew)
      });

      reachesSteps.push(reachesStep);

      // Fix point: Map'ы равны за 2е последних итерации
      const lastIteration = reachesSteps.at(reachesSteps.length - 1)!;
      const preLastIteration = reachesSteps.at(reachesSteps.length - 2)!;


      let areEqual = true;

      if (lastIteration.size !== preLastIteration.size) {
        areEqual = false;
        continue;
      }

      for (const [num1, mapOfValues1] of lastIteration) {
        const mapOfValues2 = preLastIteration.get(num1)

        if (!mapOfValues2) {
          areEqual = false;
          break;
        }

        if (mapOfValues1.size !== mapOfValues2.size) {
          areEqual = false;
          break;
        }

        for (const [key, arr1] of mapOfValues1) {
          const arr2 = mapOfValues2.get(key)

          if (!arr2 || arr1.length !== arr2.length) {
            areEqual = false;
            break;
          }

          for (const el1 of arr1) {
            if (!arr2.includes(el1)) {
              areEqual = false;
              break;
            }
          }
        }
      }

      if (areEqual) {
        console.log(lastIteration)
        break
      }
    }

    return ["Done"];
  }
}
