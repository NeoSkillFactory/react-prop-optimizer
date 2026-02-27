const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const t = require("@babel/types");

/**
 * Parse a JSX/TSX source string into a Babel AST.
 */
function parseSource(source, filename = "component.jsx") {
  const isTSX = filename.endsWith(".tsx") || filename.endsWith(".ts");
  return parser.parse(source, {
    sourceType: "module",
    plugins: [
      "jsx",
      isTSX ? "typescript" : null,
      "classProperties",
      "optionalChaining",
      "nullishCoalescingOperator",
    ].filter(Boolean),
  });
}

/**
 * Generate code string from a Babel AST.
 */
function generateCode(ast) {
  return generate(ast, { retainLines: false, concise: false }).code;
}

/**
 * Extract all React component declarations from an AST.
 * Returns an array of { name, node, type, params } objects.
 *   type: "function" | "arrow" | "class"
 */
function extractComponents(ast) {
  const components = [];

  traverse(ast, {
    // function MyComponent(props) { ... }
    FunctionDeclaration(path) {
      if (isComponentName(path.node.id?.name)) {
        components.push({
          name: path.node.id.name,
          node: path.node,
          path,
          type: "function",
          params: path.node.params,
        });
      }
    },
    // const MyComponent = (props) => { ... }
    // const MyComponent = function(props) { ... }
    VariableDeclarator(path) {
      if (!isComponentName(path.node.id?.name)) return;
      const init = path.node.init;
      if (
        t.isArrowFunctionExpression(init) ||
        t.isFunctionExpression(init)
      ) {
        components.push({
          name: path.node.id.name,
          node: init,
          path,
          type: t.isArrowFunctionExpression(init) ? "arrow" : "function",
          params: init.params,
        });
      }
    },
    // class MyComponent extends React.Component { ... }
    ClassDeclaration(path) {
      if (isComponentName(path.node.id?.name) && isReactClass(path.node)) {
        components.push({
          name: path.node.id.name,
          node: path.node,
          path,
          type: "class",
          params: [],
        });
      }
    },
  });

  return components;
}

/**
 * Check if a name looks like a React component (PascalCase).
 */
function isComponentName(name) {
  return typeof name === "string" && /^[A-Z]/.test(name);
}

/**
 * Check if a class extends React.Component or Component.
 */
function isReactClass(node) {
  const sc = node.superClass;
  if (!sc) return false;
  if (t.isIdentifier(sc) && sc.name === "Component") return true;
  if (t.isIdentifier(sc) && sc.name === "PureComponent") return true;
  if (
    t.isMemberExpression(sc) &&
    t.isIdentifier(sc.object, { name: "React" }) &&
    (t.isIdentifier(sc.property, { name: "Component" }) ||
      t.isIdentifier(sc.property, { name: "PureComponent" }))
  ) {
    return true;
  }
  return false;
}

/**
 * Get the body node of a component for scoped traversal.
 */
function getComponentBody(componentInfo) {
  const node = componentInfo.node;
  if (t.isFunctionDeclaration(node) || t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) {
    return node.body;
  }
  if (t.isClassDeclaration(node) || t.isClassExpression(node)) {
    return node.body;
  }
  return null;
}

/**
 * Traverse only within a specific subtree node using a temporary wrapper AST.
 */
function traverseNode(node, visitors) {
  // Wrap the node in a program so traverse can handle it
  const wrapper = t.file(t.program([
    t.isStatement(node) ? node : t.expressionStatement(node),
  ]));
  traverse(wrapper, visitors);
}

/**
 * Extract prop names used inside a component body from a function component.
 * Handles both destructured props and props.xxx member expressions.
 */
function extractPropNames(componentInfo, _ast) {
  const props = new Set();

  if (componentInfo.type === "class") {
    const body = getComponentBody(componentInfo);
    if (!body) return [];
    traverseNode(componentInfo.node, {
      MemberExpression(path) {
        if (
          t.isMemberExpression(path.node.object) &&
          t.isThisExpression(path.node.object.object) &&
          t.isIdentifier(path.node.object.property, { name: "props" }) &&
          t.isIdentifier(path.node.property)
        ) {
          props.add(path.node.property.name);
        }
      },
    });
    return Array.from(props);
  }

  const params = componentInfo.params;
  if (!params || params.length === 0) return [];

  const firstParam = params[0];

  // Destructured: function Comp({ a, b, c }) { ... }
  if (t.isObjectPattern(firstParam)) {
    for (const prop of firstParam.properties) {
      if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
        props.add(prop.key.name);
      } else if (t.isRestElement(prop) && t.isIdentifier(prop.argument)) {
        props.add(`...${prop.argument.name}`);
      }
    }
  }

  // Named: function Comp(props) { ... }
  if (t.isIdentifier(firstParam)) {
    const propsName = firstParam.name;
    traverseNode(componentInfo.node, {
      MemberExpression(path) {
        if (
          t.isIdentifier(path.node.object, { name: propsName }) &&
          t.isIdentifier(path.node.property)
        ) {
          props.add(path.node.property.name);
        }
      },
    });
  }

  return Array.from(props);
}

/**
 * Find JSX elements that pass props through to children within a component.
 * Returns an array of { childComponent, propsPassedThrough: string[] } objects.
 */
function findPropPassthrough(componentInfo, ast) {
  const passthroughs = [];
  const componentProps = new Set(extractPropNames(componentInfo, ast));

  if (componentProps.size === 0) return passthroughs;

  traverseNode(componentInfo.node, {
    JSXOpeningElement(path) {
      const elementName = getJSXElementName(path.node.name);
      if (!isComponentName(elementName)) return;

      const passedProps = [];
      for (const attr of path.node.attributes) {
        if (t.isJSXAttribute(attr) && (t.isJSXIdentifier(attr.name) || t.isIdentifier(attr.name))) {
          const attrName = attr.name.name;
          if (componentProps.has(attrName)) {
            passedProps.push(attrName);
          }
        }
        if (t.isJSXSpreadAttribute(attr)) {
          passedProps.push("...spread");
        }
      }

      if (passedProps.length > 0) {
        passthroughs.push({
          childComponent: elementName,
          propsPassedThrough: passedProps,
        });
      }
    },
  });

  return passthroughs;
}

/**
 * Get the name string from a JSX element name node.
 */
function getJSXElementName(nameNode) {
  if (t.isJSXIdentifier(nameNode)) return nameNode.name;
  if (t.isJSXMemberExpression(nameNode)) {
    return `${getJSXElementName(nameNode.object)}.${nameNode.property.name}`;
  }
  return "";
}

/**
 * Capitalize the first letter of a string.
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert a camelCase string to a SCREAMING_SNAKE_CASE string.
 */
function toScreamingSnake(str) {
  return str.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

/**
 * Infer a TypeScript type for a prop name based on naming conventions.
 */
function inferPropType(propName) {
  if (propName.startsWith("on") && propName[2]?.toUpperCase() === propName[2]) {
    return "() => void";
  }
  if (propName.startsWith("is") || propName.startsWith("has") || propName.startsWith("show")) {
    return "boolean";
  }
  if (propName.endsWith("Count") || propName.endsWith("Index") || propName.endsWith("Size")) {
    return "number";
  }
  if (propName.endsWith("List") || propName.endsWith("Items") || propName.endsWith("s")) {
    // Could be array, but default to generic
  }
  if (propName === "children") {
    return "React.ReactNode";
  }
  if (propName === "className" || propName === "style") {
    return propName === "className" ? "string" : "React.CSSProperties";
  }
  return "any";
}

module.exports = {
  parseSource,
  generateCode,
  extractComponents,
  extractPropNames,
  findPropPassthrough,
  isComponentName,
  capitalize,
  toScreamingSnake,
  inferPropType,
  getJSXElementName,
};
