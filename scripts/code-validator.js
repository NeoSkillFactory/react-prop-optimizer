const { parseSource } = require("./utils");

/**
 * Validate generated code for syntactic correctness and React best practices.
 *
 * @param {string} code - The generated code to validate
 * @param {object} [options]
 * @param {string} [options.filename="generated.tsx"] - Filename hint for parser
 * @returns {{ valid: boolean, errors: string[], warnings: string[], score: number }}
 */
function validateCode(code, options = {}) {
  const { filename = "generated.tsx" } = options;
  const errors = [];
  const warnings = [];

  // 1. Syntax validation: try to parse
  try {
    parseSource(code, filename);
  } catch (err) {
    errors.push(`Syntax error: ${err.message}`);
    return { valid: false, errors, warnings, score: 0 };
  }

  // 2. Best practice checks
  checkContextBestPractices(code, warnings);
  checkHookBestPractices(code, warnings);
  checkTypeScriptPractices(code, warnings);
  checkMemoization(code, warnings);
  checkNamingConventions(code, warnings);

  const deductions = errors.length * 20 + warnings.length * 5;
  const score = Math.max(0, 100 - deductions);

  return { valid: errors.length === 0, errors, warnings, score };
}

/**
 * Check Context API best practices.
 */
function checkContextBestPractices(code, warnings) {
  // Check that createContext is called with undefined or default
  if (code.includes("createContext()")) {
    warnings.push(
      "Context created without default value. Consider providing undefined explicitly for better type inference."
    );
  }

  // Check for Provider without memoized value
  if (code.includes(".Provider") && !code.includes("useMemo")) {
    warnings.push(
      "Context Provider value is not memoized. This may cause unnecessary re-renders."
    );
  }

  // Check for missing error boundary in hook
  if (code.includes("useContext") && !code.includes("undefined")) {
    warnings.push(
      "Custom context hook should check for undefined and throw a helpful error message."
    );
  }
}

/**
 * Check React Hook best practices.
 */
function checkHookBestPractices(code, warnings) {
  // Custom hooks should start with "use"
  const functionMatches = code.match(/export\s+function\s+(\w+)/g) || [];
  for (const match of functionMatches) {
    const name = match.replace(/export\s+function\s+/, "");
    if (
      name.startsWith("use") &&
      name[3] &&
      name[3] === name[3].toUpperCase()
    ) {
      // Valid hook name — good
    } else if (name.startsWith("use")) {
      warnings.push(
        `Hook "${name}" should follow naming convention: use[PascalCase].`
      );
    }
  }
}

/**
 * Check TypeScript best practices.
 */
function checkTypeScriptPractices(code, warnings) {
  // Check for 'any' type usage
  const anyCount = (code.match(/:\s*any\b/g) || []).length;
  if (anyCount > 0) {
    warnings.push(
      `Found ${anyCount} usage(s) of "any" type. Consider using more specific types.`
    );
  }

  // Check for proper interface exports
  if (code.includes("interface ") && !code.includes("export interface")) {
    warnings.push(
      "Interfaces should be exported for reuse in consuming components."
    );
  }
}

/**
 * Check memoization practices.
 */
function checkMemoization(code, warnings) {
  // Check for inline object/array creation in JSX props
  if (code.match(/value=\{\s*\{/)) {
    warnings.push(
      "Inline object creation in JSX props may cause unnecessary re-renders. Use useMemo."
    );
  }
}

/**
 * Check naming conventions.
 */
function checkNamingConventions(code, warnings) {
  // Check for PascalCase component names
  const compMatches = code.match(/function\s+([A-Z]\w+)/g) || [];
  for (const match of compMatches) {
    const name = match.replace(/function\s+/, "");
    if (name.endsWith("Provider") || name.endsWith("Consumer")) {
      // Valid naming for context components
    }
  }
}

/**
 * Validate multiple code solutions and return a combined report.
 */
function validateSolutions(solutions) {
  const results = [];

  for (const solution of solutions) {
    const code = solution.generated?.fullCode || solution.generated?.code || "";
    if (!code) {
      results.push({
        source: solution.sourceComponent || "unknown",
        valid: false,
        errors: ["No code generated"],
        warnings: [],
        score: 0,
      });
      continue;
    }

    const validation = validateCode(code);
    results.push({
      source: solution.sourceComponent || "unknown",
      strategy: solution.generated?.library || "context",
      ...validation,
    });
  }

  const allValid = results.every((r) => r.valid);
  const avgScore =
    results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
      : 0;

  return {
    allValid,
    averageScore: avgScore,
    results,
  };
}

/**
 * Format a validation report as a readable string.
 */
function formatValidationReport(report) {
  const lines = [];
  lines.push("\n=== Validation Report ===");
  lines.push(`Overall: ${report.allValid ? "PASS" : "FAIL"} | Average Score: ${report.averageScore}/100`);

  for (const result of report.results) {
    lines.push(`\n  [${result.valid ? "PASS" : "FAIL"}] ${result.source} (${result.strategy || "context"}) — Score: ${result.score}/100`);
    for (const err of result.errors) {
      lines.push(`    ERROR: ${err}`);
    }
    for (const warn of result.warnings) {
      lines.push(`    WARN: ${warn}`);
    }
  }

  return lines.join("\n");
}

module.exports = {
  validateCode,
  validateSolutions,
  formatValidationReport,
};
