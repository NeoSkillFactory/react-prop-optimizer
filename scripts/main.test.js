const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const { parseSource, extractComponents, extractPropNames, findPropPassthrough, inferPropType, capitalize, toScreamingSnake } = require("./utils");
const { analyzeFile, analyzeDirectory, detectDrillingChains, computeDrillingScore, formatReport } = require("./react-analyzer");
const { generateContext, generateContextsFromAnalysis } = require("./context-generator");
const { generateStore, generateStoresFromAnalysis } = require("./state-mgmt-generator");
const { validateCode, validateSolutions, formatValidationReport } = require("./code-validator");

const FIXTURES_DIR = path.join(__dirname, "..", "assets", "test-cases");
const EXAMPLES_DIR = path.join(__dirname, "..", "assets", "examples");

// === utils.js tests ===

describe("utils", () => {
  describe("parseSource", () => {
    it("parses valid JSX", () => {
      const ast = parseSource('const App = () => <div>hello</div>;');
      assert.ok(ast);
      assert.equal(ast.type, "File");
    });

    it("parses TSX with TypeScript", () => {
      const ast = parseSource('const App: React.FC<Props> = () => <div />;', "app.tsx");
      assert.ok(ast);
    });

    it("throws on invalid syntax", () => {
      assert.throws(() => parseSource("const =;"));
    });
  });

  describe("extractComponents", () => {
    it("finds function declarations", () => {
      const ast = parseSource('function MyComp({ a }) { return <div>{a}</div>; }');
      const comps = extractComponents(ast);
      assert.equal(comps.length, 1);
      assert.equal(comps[0].name, "MyComp");
      assert.equal(comps[0].type, "function");
    });

    it("finds arrow function components", () => {
      const ast = parseSource('const MyComp = ({ a }) => <div>{a}</div>;');
      const comps = extractComponents(ast);
      assert.equal(comps.length, 1);
      assert.equal(comps[0].name, "MyComp");
      assert.equal(comps[0].type, "arrow");
    });

    it("ignores non-PascalCase functions", () => {
      const ast = parseSource('function helper() { return 1; }');
      const comps = extractComponents(ast);
      assert.equal(comps.length, 0);
    });

    it("finds multiple components in one file", () => {
      const src = `
        function App() { return <div />; }
        const Header = () => <nav />;
        function Footer() { return <footer />; }
      `;
      const ast = parseSource(src);
      const comps = extractComponents(ast);
      assert.equal(comps.length, 3);
    });
  });

  describe("extractPropNames", () => {
    it("extracts destructured props", () => {
      const ast = parseSource('function Comp({ name, age, onClick }) { return <div />; }');
      const comps = extractComponents(ast);
      const props = extractPropNames(comps[0], ast);
      assert.deepEqual(props.sort(), ["age", "name", "onClick"]);
    });

    it("returns empty for no params", () => {
      const ast = parseSource('function Comp() { return <div />; }');
      const comps = extractComponents(ast);
      const props = extractPropNames(comps[0], ast);
      assert.deepEqual(props, []);
    });
  });

  describe("findPropPassthrough", () => {
    it("detects props passed to child components", () => {
      const src = `
        function Parent({ name, age }) {
          return <Child name={name} age={age} />;
        }
        function Child({ name, age }) {
          return <div>{name} {age}</div>;
        }
      `;
      const ast = parseSource(src);
      const comps = extractComponents(ast);
      const parent = comps.find(c => c.name === "Parent");
      const pt = findPropPassthrough(parent, ast);
      assert.equal(pt.length, 1);
      assert.equal(pt[0].childComponent, "Child");
      assert.deepEqual(pt[0].propsPassedThrough.sort(), ["age", "name"]);
    });

    it("returns empty when no passthrough", () => {
      const src = 'function Leaf({ x }) { return <div>{x}</div>; }';
      const ast = parseSource(src);
      const comps = extractComponents(ast);
      const pt = findPropPassthrough(comps[0], ast);
      assert.equal(pt.length, 0);
    });

    it("only reports props passed to PascalCase children", () => {
      const src = `
        function Comp({ cls }) {
          return <div className={cls}><span /></div>;
        }
      `;
      const ast = parseSource(src);
      const comps = extractComponents(ast);
      const pt = findPropPassthrough(comps[0], ast);
      assert.equal(pt.length, 0);
    });
  });

  describe("inferPropType", () => {
    it("infers callback types", () => {
      assert.equal(inferPropType("onClick"), "() => void");
      assert.equal(inferPropType("onSubmit"), "() => void");
    });

    it("infers boolean types", () => {
      assert.equal(inferPropType("isActive"), "boolean");
      assert.equal(inferPropType("hasData"), "boolean");
      assert.equal(inferPropType("showModal"), "boolean");
    });

    it("infers number types", () => {
      assert.equal(inferPropType("itemCount"), "number");
      assert.equal(inferPropType("pageIndex"), "number");
    });

    it("infers children type", () => {
      assert.equal(inferPropType("children"), "React.ReactNode");
    });

    it("defaults to any", () => {
      assert.equal(inferPropType("data"), "any");
    });
  });

  describe("capitalize", () => {
    it("capitalizes first letter", () => {
      assert.equal(capitalize("hello"), "Hello");
      assert.equal(capitalize("a"), "A");
    });
  });

  describe("toScreamingSnake", () => {
    it("converts camelCase", () => {
      assert.equal(toScreamingSnake("userName"), "USER_NAME");
      assert.equal(toScreamingSnake("isAdmin"), "IS_ADMIN");
    });
  });
});

// === react-analyzer.js tests ===

describe("react-analyzer", () => {
  describe("analyzeFile", () => {
    it("analyzes the basic example", () => {
      const result = analyzeFile(path.join(EXAMPLES_DIR, "basic-component.jsx"));
      assert.equal(result.summary.totalComponents, 8);
      assert.ok(result.summary.totalProps > 0);
      assert.ok(result.summary.drilledProps > 0);
    });

    it("analyzes simple drilling test case", () => {
      const result = analyzeFile(path.join(FIXTURES_DIR, "simple-drilling.jsx"));
      assert.equal(result.summary.totalComponents, 3);
      assert.ok(result.summary.drilledProps > 0);
    });

    it("reports zero drilling for no-drilling case", () => {
      const result = analyzeFile(path.join(FIXTURES_DIR, "no-drilling.jsx"));
      assert.equal(result.summary.drilledProps, 0);
      assert.equal(result.summary.drillingScore, 0);
    });
  });

  describe("analyzeDirectory", () => {
    it("analyzes all files in directory", () => {
      const results = analyzeDirectory(FIXTURES_DIR);
      assert.ok(results.length >= 3);
    });
  });

  describe("detectDrillingChains", () => {
    it("detects chains in simple drilling", () => {
      const result = analyzeFile(path.join(FIXTURES_DIR, "simple-drilling.jsx"));
      const chains = detectDrillingChains([result]);
      assert.ok(chains.length > 0);
      const deepChain = chains.find(c => c.depth === 3);
      assert.ok(deepChain, "Should find a depth-3 chain");
    });
  });

  describe("computeDrillingScore", () => {
    it("returns 0 for no props", () => {
      assert.equal(computeDrillingScore(0, 0, 0), 0);
    });

    it("returns higher score for more drilling", () => {
      const low = computeDrillingScore(5, 1, 1);
      const high = computeDrillingScore(5, 5, 3);
      assert.ok(high > low);
    });
  });

  describe("formatReport", () => {
    it("produces a non-empty string", () => {
      const result = analyzeFile(path.join(FIXTURES_DIR, "simple-drilling.jsx"));
      const report = formatReport(result);
      assert.ok(report.length > 0);
      assert.ok(report.includes("Parent"));
    });
  });
});

// === context-generator.js tests ===

describe("context-generator", () => {
  describe("generateContext", () => {
    it("generates valid context code", () => {
      const result = generateContext({
        contextName: "Theme",
        props: ["color", "isDark"],
        typescript: true,
      });
      assert.ok(result.fullCode.includes("ThemeContext"));
      assert.ok(result.fullCode.includes("ThemeProvider"));
      assert.ok(result.fullCode.includes("useTheme"));
      assert.ok(result.fullCode.includes("createContext"));
    });

    it("includes TypeScript interfaces when enabled", () => {
      const result = generateContext({
        contextName: "Auth",
        props: ["isLoggedIn", "onLogout"],
        typescript: true,
      });
      assert.ok(result.fullCode.includes("interface"));
      assert.ok(result.fullCode.includes("AuthContextValue"));
    });

    it("generates memoized provider", () => {
      const result = generateContext({
        contextName: "User",
        props: ["name"],
        typescript: true,
      });
      assert.ok(result.fullCode.includes("useMemo"));
    });
  });

  describe("generateContextsFromAnalysis", () => {
    it("generates contexts for components with drilling", () => {
      const result = analyzeFile(path.join(EXAMPLES_DIR, "basic-component.jsx"));
      const solutions = generateContextsFromAnalysis(result);
      assert.ok(solutions.length > 0);
      assert.ok(solutions[0].generated.fullCode.length > 0);
    });

    it("returns empty for no-drilling files", () => {
      const result = analyzeFile(path.join(FIXTURES_DIR, "no-drilling.jsx"));
      const solutions = generateContextsFromAnalysis(result);
      assert.equal(solutions.length, 0);
    });
  });
});

// === state-mgmt-generator.js tests ===

describe("state-mgmt-generator", () => {
  describe("generateStore", () => {
    it("generates Redux store", () => {
      const result = generateStore({
        storeName: "user",
        props: ["name", "isAdmin"],
        library: "redux",
      });
      assert.equal(result.library, "redux");
      assert.ok(result.code.includes("createSlice"));
      assert.ok(result.dependencies.includes("@reduxjs/toolkit"));
    });

    it("generates Zustand store", () => {
      const result = generateStore({
        storeName: "theme",
        props: ["color", "isDark"],
        library: "zustand",
      });
      assert.equal(result.library, "zustand");
      assert.ok(result.code.includes("create"));
      assert.ok(result.dependencies.includes("zustand"));
    });

    it("generates Jotai atoms", () => {
      const result = generateStore({
        storeName: "settings",
        props: ["showSidebar", "itemCount"],
        library: "jotai",
      });
      assert.equal(result.library, "jotai");
      assert.ok(result.code.includes("atom"));
      assert.ok(result.dependencies.includes("jotai"));
    });

    it("throws for unknown library", () => {
      assert.throws(() =>
        generateStore({ storeName: "x", props: ["a"], library: "mobx" })
      );
    });
  });

  describe("generateStoresFromAnalysis", () => {
    it("generates stores for drilling patterns", () => {
      const result = analyzeFile(path.join(EXAMPLES_DIR, "basic-component.jsx"));
      for (const lib of ["redux", "zustand", "jotai"]) {
        const solutions = generateStoresFromAnalysis(result, lib);
        assert.ok(solutions.length > 0, `Should generate ${lib} solutions`);
      }
    });
  });
});

// === code-validator.js tests ===

describe("code-validator", () => {
  describe("validateCode", () => {
    it("validates valid code", () => {
      const code = `
import React, { createContext, useContext, useMemo } from "react";
export interface ThemeContextValue { color: string; }
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
      `;
      const result = validateCode(code);
      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    it("catches syntax errors", () => {
      const result = validateCode("const =;");
      assert.equal(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.equal(result.score, 0);
    });

    it("warns about any types", () => {
      const code = 'const x: any = 1; const y: any = 2;';
      const result = validateCode(code);
      assert.ok(result.warnings.some(w => w.includes("any")));
    });
  });

  describe("validateSolutions", () => {
    it("validates generated context solutions", () => {
      const result = analyzeFile(path.join(EXAMPLES_DIR, "basic-component.jsx"));
      const solutions = generateContextsFromAnalysis(result);
      const report = validateSolutions(solutions);
      assert.equal(report.allValid, true);
      assert.ok(report.averageScore > 70);
    });

    it("validates generated store solutions", () => {
      const result = analyzeFile(path.join(EXAMPLES_DIR, "basic-component.jsx"));
      for (const lib of ["redux", "zustand", "jotai"]) {
        const solutions = generateStoresFromAnalysis(result, lib);
        const report = validateSolutions(solutions);
        assert.equal(report.allValid, true, `${lib} solutions should be valid`);
      }
    });
  });

  describe("formatValidationReport", () => {
    it("produces readable output", () => {
      const report = {
        allValid: true,
        averageScore: 95,
        results: [{ source: "App", strategy: "context", valid: true, score: 95, errors: [], warnings: [] }],
      };
      const output = formatValidationReport(report);
      assert.ok(output.includes("PASS"));
      assert.ok(output.includes("95/100"));
    });
  });
});

// === Integration / CLI tests ===

describe("integration", () => {
  it("full pipeline on complex-drilling.jsx", () => {
    const result = analyzeFile(path.join(FIXTURES_DIR, "complex-drilling.jsx"));
    assert.equal(result.summary.totalComponents, 8);
    assert.ok(result.summary.drilledProps > 10);
    assert.ok(result.summary.drillingScore > 0);

    const contextSolutions = generateContextsFromAnalysis(result);
    assert.ok(contextSolutions.length >= 3);

    const zustandSolutions = generateStoresFromAnalysis(result, "zustand");
    assert.ok(zustandSolutions.length >= 3);

    const allSolutions = [...contextSolutions, ...zustandSolutions];
    const report = validateSolutions(allSolutions);
    assert.equal(report.allValid, true);
  });

  it("detects drilling chains across multiple files", () => {
    const results = analyzeDirectory(FIXTURES_DIR);
    const chains = detectDrillingChains(results);
    const deep = chains.filter(c => c.depth >= 3);
    assert.ok(deep.length > 0, "Should find depth-3+ chains");
  });
});
