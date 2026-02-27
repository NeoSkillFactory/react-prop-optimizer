const fs = require("fs");
const path = require("path");
const {
  parseSource,
  extractComponents,
  extractPropNames,
  findPropPassthrough,
} = require("./utils");

/**
 * Analyze a single React component file for prop drilling patterns.
 *
 * Returns an AnalysisResult object:
 * {
 *   file: string,
 *   components: [{
 *     name: string,
 *     props: string[],
 *     propCount: number,
 *     passthroughs: [{ childComponent: string, propsPassedThrough: string[] }],
 *     drillingScore: number,   // 0-100 severity score
 *     drillingDepth: number,
 *   }],
 *   summary: { totalComponents, totalProps, drilledProps, drillingScore }
 * }
 */
function analyzeFile(filePath) {
  const source = fs.readFileSync(filePath, "utf-8");
  const filename = path.basename(filePath);
  const ast = parseSource(source, filename);
  const components = extractComponents(ast);

  const analyzed = components.map((comp) => {
    const props = extractPropNames(comp, ast);
    const passthroughs = findPropPassthrough(comp, ast);

    const drilledPropCount = passthroughs.reduce(
      (sum, pt) => sum + pt.propsPassedThrough.length,
      0
    );
    const drillingScore = computeDrillingScore(props.length, drilledPropCount, passthroughs.length);

    return {
      name: comp.name,
      type: comp.type,
      props,
      propCount: props.length,
      passthroughs,
      drilledPropCount,
      drillingScore,
    };
  });

  const totalProps = analyzed.reduce((s, c) => s + c.propCount, 0);
  const drilledProps = analyzed.reduce((s, c) => s + c.drilledPropCount, 0);
  const avgScore =
    analyzed.length > 0
      ? Math.round(analyzed.reduce((s, c) => s + c.drillingScore, 0) / analyzed.length)
      : 0;

  return {
    file: filePath,
    components: analyzed,
    summary: {
      totalComponents: analyzed.length,
      totalProps,
      drilledProps,
      drillingScore: avgScore,
    },
  };
}

/**
 * Analyze all JSX/TSX files in a directory (non-recursive).
 */
function analyzeDirectory(dirPath) {
  const extensions = [".jsx", ".tsx", ".js", ".ts"];
  const files = fs.readdirSync(dirPath).filter((f) => {
    const ext = path.extname(f);
    return extensions.includes(ext);
  });

  const results = [];
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    try {
      results.push(analyzeFile(fullPath));
    } catch (err) {
      results.push({
        file: fullPath,
        error: err.message,
        components: [],
        summary: { totalComponents: 0, totalProps: 0, drilledProps: 0, drillingScore: 0 },
      });
    }
  }

  return results;
}

/**
 * Build a component dependency tree from multiple analysis results.
 * Returns a map of componentName -> [child component names that receive drilled props].
 */
function buildDependencyTree(analysisResults) {
  const tree = {};
  for (const result of analysisResults) {
    for (const comp of result.components) {
      if (!tree[comp.name]) tree[comp.name] = [];
      for (const pt of comp.passthroughs) {
        tree[comp.name].push({
          child: pt.childComponent,
          drilledProps: pt.propsPassedThrough,
        });
      }
    }
  }
  return tree;
}

/**
 * Detect prop drilling chains: sequences of components where the same prop
 * is passed through 2+ levels without being consumed.
 */
function detectDrillingChains(analysisResults) {
  const tree = buildDependencyTree(analysisResults);
  const chains = [];

  // For each root component, trace prop paths
  for (const [compName, children] of Object.entries(tree)) {
    for (const child of children) {
      for (const prop of child.drilledProps) {
        if (prop === "...spread") continue;
        const chain = [compName, child.child];
        let current = child.child;
        // Walk down the tree
        while (tree[current]) {
          const nextHop = tree[current].find((c) =>
            c.drilledProps.includes(prop)
          );
          if (!nextHop) break;
          chain.push(nextHop.child);
          current = nextHop.child;
        }
        if (chain.length >= 2) {
          chains.push({ prop, chain, depth: chain.length });
        }
      }
    }
  }

  // Deduplicate and sort by depth
  const seen = new Set();
  return chains
    .filter((c) => {
      const key = `${c.prop}:${c.chain.join("->")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.depth - a.depth);
}

/**
 * Compute a drilling severity score (0-100) for a component.
 * Higher = worse prop drilling.
 */
function computeDrillingScore(totalProps, drilledProps, passthroughCount) {
  if (totalProps === 0) return 0;

  const drillRatio = drilledProps / totalProps;
  const countPenalty = Math.min(passthroughCount * 10, 40);
  const volumePenalty = Math.min(drilledProps * 5, 30);

  return Math.min(100, Math.round(drillRatio * 30 + countPenalty + volumePenalty));
}

/**
 * Format an analysis result as a human-readable report string.
 */
function formatReport(result) {
  const lines = [];
  lines.push(`\n=== Analysis: ${result.file} ===`);
  lines.push(
    `Components: ${result.summary.totalComponents} | Props: ${result.summary.totalProps} | Drilled: ${result.summary.drilledProps} | Score: ${result.summary.drillingScore}/100`
  );

  for (const comp of result.components) {
    lines.push(`\n  Component: ${comp.name} (${comp.type})`);
    lines.push(`    Props (${comp.propCount}): ${comp.props.join(", ") || "none"}`);
    lines.push(`    Drilling Score: ${comp.drillingScore}/100`);

    if (comp.passthroughs.length > 0) {
      lines.push("    Prop Passthroughs:");
      for (const pt of comp.passthroughs) {
        lines.push(
          `      -> ${pt.childComponent}: [${pt.propsPassedThrough.join(", ")}]`
        );
      }
    }
  }

  return lines.join("\n");
}

module.exports = {
  analyzeFile,
  analyzeDirectory,
  buildDependencyTree,
  detectDrillingChains,
  computeDrillingScore,
  formatReport,
};
