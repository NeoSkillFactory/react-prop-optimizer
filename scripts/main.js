#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { analyzeFile, analyzeDirectory, detectDrillingChains, formatReport } = require("./react-analyzer");
const { generateContext, generateContextsFromAnalysis } = require("./context-generator");
const { generateStore, generateStoresFromAnalysis } = require("./state-mgmt-generator");
const { validateCode, validateSolutions, formatValidationReport } = require("./code-validator");

const VALID_COMMANDS = ["analyze", "generate", "optimize", "help"];
const VALID_STRATEGIES = ["context", "redux", "zustand", "jotai"];

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "help" || args.flags.help) {
    printHelp();
    process.exit(0);
  }

  if (!VALID_COMMANDS.includes(args.command)) {
    console.error(`Error: Unknown command "${args.command || ""}". Use --help for usage.`);
    process.exit(1);
  }

  const filePath = args.flags.file;
  const dirPath = args.flags.dir;
  const strategy = args.flags.strategy || "context";
  const outputDir = args.flags.output;

  if (!filePath && !dirPath) {
    console.error("Error: Provide --file <path> or --dir <path>.");
    process.exit(1);
  }

  if (args.command === "generate" && !VALID_STRATEGIES.includes(strategy)) {
    console.error(`Error: Unknown strategy "${strategy}". Valid: ${VALID_STRATEGIES.join(", ")}`);
    process.exit(1);
  }

  try {
    switch (args.command) {
      case "analyze":
        runAnalyze(filePath, dirPath);
        break;
      case "generate":
        runGenerate(filePath, dirPath, strategy, outputDir);
        break;
      case "optimize":
        runOptimize(filePath, dirPath, outputDir);
        break;
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Run analysis on a file or directory.
 */
function runAnalyze(filePath, dirPath) {
  const results = getAnalysisResults(filePath, dirPath);

  for (const result of results) {
    if (result.error) {
      console.error(`Error analyzing ${result.file}: ${result.error}`);
      continue;
    }
    console.log(formatReport(result));
  }

  // Detect drilling chains across all results
  const chains = detectDrillingChains(results);
  if (chains.length > 0) {
    console.log("\n=== Prop Drilling Chains ===");
    for (const chain of chains) {
      console.log(`  "${chain.prop}": ${chain.chain.join(" -> ")} (depth: ${chain.depth})`);
    }
  }

  console.log("\nAnalysis complete.");
}

/**
 * Run code generation for a specific strategy.
 */
function runGenerate(filePath, dirPath, strategy, outputDir) {
  const results = getAnalysisResults(filePath, dirPath);
  const solutions = [];

  for (const result of results) {
    if (result.error) continue;

    if (strategy === "context") {
      solutions.push(...generateContextsFromAnalysis(result));
    } else {
      solutions.push(...generateStoresFromAnalysis(result, strategy));
    }
  }

  if (solutions.length === 0) {
    console.log("No prop drilling patterns detected. No code generated.");
    return;
  }

  console.log(`\nGenerated ${solutions.length} solution(s) using "${strategy}" strategy:\n`);

  for (const sol of solutions) {
    console.log(`--- ${sol.sourceComponent} ---`);
    const code = sol.generated.fullCode || sol.generated.code;
    console.log(code);
    console.log("");

    if (outputDir) {
      writeOutput(outputDir, sol, strategy);
    }
  }

  // Validate
  const report = validateSolutions(solutions);
  console.log(formatValidationReport(report));
}

/**
 * Run the full optimize pipeline: analyze + generate all strategies + validate.
 */
function runOptimize(filePath, dirPath, outputDir) {
  const results = getAnalysisResults(filePath, dirPath);

  // Print analysis
  for (const result of results) {
    if (result.error) {
      console.error(`Error analyzing ${result.file}: ${result.error}`);
      continue;
    }
    console.log(formatReport(result));
  }

  const chains = detectDrillingChains(results);
  if (chains.length > 0) {
    console.log("\n=== Prop Drilling Chains ===");
    for (const chain of chains) {
      console.log(`  "${chain.prop}": ${chain.chain.join(" -> ")} (depth: ${chain.depth})`);
    }
  }

  // Generate all strategies
  const allSolutions = [];
  for (const strategy of VALID_STRATEGIES) {
    const solutions = [];
    for (const result of results) {
      if (result.error) continue;
      if (strategy === "context") {
        solutions.push(...generateContextsFromAnalysis(result));
      } else {
        solutions.push(...generateStoresFromAnalysis(result, strategy));
      }
    }

    if (solutions.length > 0) {
      console.log(`\n=== ${strategy.toUpperCase()} Strategy ===`);
      for (const sol of solutions) {
        console.log(`\n--- ${sol.sourceComponent} ---`);
        const code = sol.generated.fullCode || sol.generated.code;
        console.log(code);

        if (outputDir) {
          writeOutput(outputDir, sol, strategy);
        }
      }
      allSolutions.push(...solutions);
    }
  }

  if (allSolutions.length === 0) {
    console.log("\nNo prop drilling patterns detected.");
    return;
  }

  // Validate all
  const report = validateSolutions(allSolutions);
  console.log(formatValidationReport(report));

  console.log("\nOptimization complete.");
}

/**
 * Get analysis results for a file or directory.
 */
function getAnalysisResults(filePath, dirPath) {
  if (filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return [analyzeFile(filePath)];
  }
  if (dirPath) {
    if (!fs.existsSync(dirPath)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }
    return analyzeDirectory(dirPath);
  }
  return [];
}

/**
 * Write generated code to an output directory.
 */
function writeOutput(outputDir, solution, strategy) {
  fs.mkdirSync(outputDir, { recursive: true });
  const baseName = (solution.storeName || solution.contextName || "generated").toLowerCase();
  const ext = ".tsx";
  const fileName = `${baseName}-${strategy}${ext}`;
  const outputPath = path.join(outputDir, fileName);
  const code = solution.generated.fullCode || solution.generated.code;
  fs.writeFileSync(outputPath, code, "utf-8");
  console.log(`  Written: ${outputPath}`);
}

/**
 * Parse CLI arguments into a structured object.
 */
function parseArgs(argv) {
  const result = { command: "", flags: {} };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (i === 0 && !arg.startsWith("-")) {
      result.command = arg;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      result.flags.help = true;
    } else if (arg === "--file" || arg === "-f") {
      result.flags.file = argv[++i];
    } else if (arg === "--dir" || arg === "-d") {
      result.flags.dir = argv[++i];
    } else if (arg === "--strategy" || arg === "-s") {
      result.flags.strategy = argv[++i];
    } else if (arg === "--output" || arg === "-o") {
      result.flags.output = argv[++i];
    }
  }

  return result;
}

/**
 * Print help message.
 */
function printHelp() {
  console.log(`
react-prop-optimizer — Analyze and optimize React prop drilling patterns

USAGE:
  node scripts/main.js <command> [options]

COMMANDS:
  analyze   Analyze component files for prop drilling patterns
  generate  Generate optimized alternatives using a specific strategy
  optimize  Full pipeline: analyze + generate all strategies + validate
  help      Show this help message

OPTIONS:
  --file, -f <path>       Path to a React component file (.jsx/.tsx)
  --dir,  -d <path>       Path to a directory of React components
  --strategy, -s <name>   Generation strategy: context, redux, zustand, jotai (default: context)
  --output, -o <path>     Output directory for generated files
  --help, -h              Show this help message

EXAMPLES:
  node scripts/main.js analyze --file src/App.jsx
  node scripts/main.js generate --file src/App.jsx --strategy zustand
  node scripts/main.js optimize --dir src/components/ --output generated/
`);
}

main();
