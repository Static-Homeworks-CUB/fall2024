# Assignment 1: Writing an AST-based detector

The goal of the first assignment is to write a simple AST-based detector for [Misti](https://github.com/nowarp/misti) to set up the environment and become familiar with the detectors' API.

## Context

[Misti](https://nowarp.io/tools/misti) is a static analyzer for the [Tact](https://tact-lang.org) smart-contract language. Some details about it:

- It has a small source code base [written in TypeScript](https://matklad.github.io/2023/08/17/typescript-is-surprisingly-ok-for-compilers.html).
- It targets a statically-typed language used in production.
- It is well-documented; the [documentation](https://nowarp.io/tools/misti/docs/next/) and the [API reference](https://nowarp.io/tools/misti/api/) are available.
- It provides an API to write custom detectors to implement AST-based, dataflow, and Datalog-based analyses.

All of this enables us to practice writing simple analyses on a small yet real-world project.

## Installation
The instructions below assume you are working on a Unix-like system, preferably Linux.

### Using docker
If you don't want to waste your time on setting up the Node.js development environment, you could use the prepared docker container:

```bash
docker pull jubnzv1/cub-fall2024:latest
```

Then you could introduce your changes in the `assignments` directory and switch to the Docker container in order to build the project:
```bash
docker run -it --rm -v $(pwd)/assignments:/home/student/assignments jubnzv1/cub-fall2024:latest
```

In the docker container the following commands are available:
* `yarn build` – Build the project
* `yarn fmt` – Check formatting
* `yarn lint` – Run ESLint
* `yarn test ./assignments/your-detector.spec.ts` – Run your unit tests
* `yarn misti --detectors ./assignments/your-detector.ts:YourDetectorClassName /path/to/contract.tact` – Running Misti solely with your detector

### Installing locally
1. Install Node.js version 22 or higher. You can do this using `nvm`:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install v22.2.0 && nvm alias default v22.2.0
```
2. Install Soufflé according to the [official installation instructions](https://souffle-lang.github.io/install)
3. Install Yarn: `npm install -g yarn`
4. Install the latest version of Misti:
```
git submodule update --init --recursive
pushd ./deps/misti/
yarn install && yarn build
popd
```
5. Build the npm dependencies: `yarn install`

## Assignment steps

1. **Choosing a task:** Choose [one of the non-assigned issues labeled `assignment-1`](https://github.com/Static-Homeworks-CUB/fall2024/issues?q=is%3Aissue+is%3Aopen+no%3Aassignee) or suggest your own detector:
   <details>
   <summary>Suggesting your own detector</summary>

   You can suggest your own AST-based detector: [https://github.com/Static-Homeworks-CUB/fall2024/issues/new?assignees=jubnzv&labels=triage%2Cassignment-1&projects=&template=assignment-1-suggestion.md](https://github.com/Static-Homeworks-CUB/fall2024/issues/new?assignees=jubnzv&labels=triage%2Cassignment-1&projects=&template=assignment-1-suggestion.md).
   The detectors used in the first assignment should be simple and use the program's AST representation.

   They don't have to address real-world problems, but it is always beneficial if your detector represents an idea applicable to real-world projects.
   You can get inspiration for such detectors by reading various coding standards and the documentation of other static analyzers.

   - MISRA C/C++ and AUTOSAR C++ rules: coding standards used in development of embedded safety-critical systems
   - Slither detector documentation: [https://github.com/crytic/slither/wiki/Detector-Documentation](https://github.com/crytic/slither/wiki/Detector-Documentation)
   - SmartCheck rules: [https://github.com/smartdec/smartcheck](https://github.com/smartdec/smartcheck)

   If you have any idea, please [create an issue](https://github.com/nowarp/misti/issues/new?assignees=&labels=triage&projects=&template=assignment-1-suggestion.md&title=), and we will approve it ASAP.

   </details>

2. **Assigning the issue:** Assign yourself to the chosen issue in the GitHub interface: ![](../../img/assign-github.png)
3. **Examining the source code:** Examine the source code in this directory. You could take a look at [the `SingleLetterIdentifier` detector](./singleLetterIdentifier) here as an example.
4. **Writing the detector:** Create your own detector following the same code structure as the existing ones.
5. **Writing tests:** Write unit tests to show that your implementation works correctly. Use `*.spec.ts` files in this directory as an example.
6. **Running linters and tests:** Ensure the ESLint linter and the Prettier formatter don't report on your code and your detector passing tests: `yarn test-all`. Typically, you can automatically fix some errors using `yarn fix-all`.
7. **Committing changes:** Commit and push changes to your fork. Create a pull request to the main repo: [https://github.com/Static-Homeworks-CUB/fall2024/pulls](https://github.com/Static-Homeworks-CUB/fall2024/pulls)

If you have any questions regarding the task description, feel free to reach out to us in the issue. Otherwise, we are available in the course chat.

## Resources

1. [Static Program Analysis](https://cs.au.dk/~amoeller/spa/spa.pdf) by Anders Møller and Michael I. Schwartzbach (2024) – A textbook, if you need a recap on basics of program analysis.
2. https://nowarp.io/tools/misti/docs/next/ – Misti Documentation (ensure you are reading the `next` version)
3. https://nowarp.io/tools/misti/api/ – Misti API reference
4. https://docs.tact-lang.org/ – Tact Documentation
5. https://tact-by-example.org/all – Example Tact contracts with the description
6. https://github.com/tact-lang/tact/tree/main/examples and https://github.com/tact-lang/tact/tree/main/src/test/e2e-emulated/contracts – More Tact contracts
7. https://github.com/tact-lang/tact/blob/main/src/grammar/ast.ts – Tact AST
8. https://www.typescriptlang.org/docs/ – TypeScript documentation
