import { ConfigProject } from "@tact-lang/compiler/dist/config/parseConfig";
import { CompilerContext } from "@tact-lang/compiler/dist/context";
import { getRawAST } from "@tact-lang/compiler/dist/grammar/store";
import { AstStore } from "@tact-lang/compiler/dist/grammar/store";
import { Logger } from "@tact-lang/compiler/dist/logger";
import { enableFeatures } from "@tact-lang/compiler/dist/pipeline/build";
import { precompile } from "@tact-lang/compiler/dist/pipeline/precompile";
import { createNodeFileSystem } from "@tact-lang/compiler/dist/vfs/createNodeFileSystem";
import path from "path";
import { writeFileSync } from "fs";

const TACT_FILE_PATH = path.join(__dirname, "contracts/test.tact");

/**
 * Parses a Tact source file and returns its AST
 * @param sourceFilePath Absolute path to the Tact source file
 * @returns AstStore containing the parsed AST, or null if parsing fails
 */
export function parseTact(code: string): AstStore | null {
  writeFileSync(TACT_FILE_PATH, code);

  const projectConfig = {
    name: "test",
    path: TACT_FILE_PATH,
    output: "/tmp/misti/output",
    options: {
      debug: false,
      external: true,
    },
  } as ConfigProject;
  const project = createNodeFileSystem(__dirname, false);

  // XXX: We don't use the original stdlib here, since the symbolic execution
  // engine cannot process all the Tact definitions from it.
  const stdlibPath = path.resolve(__dirname, "./stdlib");

  const stdlib = createNodeFileSystem(stdlibPath, false);
  const logger = new Logger();

  let ctx = new CompilerContext();
  ctx = enableFeatures(ctx, logger, projectConfig);
  ctx = precompile(ctx, project, stdlib, projectConfig.path);
  return getRawAST(ctx);
}
