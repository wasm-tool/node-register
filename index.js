function trampoline(name, to) {
  return `(function ${name}(...args) {
            if (typeof ${to} !== "function") {
              throw new Error('${to} expected to be a function');
            }
            return ${to}(...args);
          })`;
}

function generateExports(exports) {
  return exports.reduce((code, e) => {
    if (e.kind === "function" || e.kind === "memory" || e.kind === "table") {
      return (
        code +
        `module.exports["${e.name}"] = wasminstance.exports["${e.name}"];\n`
      );
    }
    throw new Error("unimplemented export kind: " + e.kind);
  }, '');
}

function generateImports(imports, basedir) {
  // keep track of module we imported in generated code
  const importedModule = {};

  return imports.reduce((code, imp) => {
    if (imp.kind !== "function") {
      throw new Error("unimplemented import kind: " + imp.kind);
    }
    if (!importedModule[imp.module] && imp.module !== "env") {
      code += `jsimports["${imp.module}"] = require(join("${basedir}", "${imp.module}"));\n`;
      code += `wasmimports["${imp.module}"] = {}\n`;
      importedModule[imp.module] = true;
    }

    code +=
      `wasmimports["${imp.module}"]["${imp.name}"] = ` +
      trampoline(imp.name, `jsimports["${imp.module}"]["${imp.name}"]`) +
      ';\n';
    return code;
  }, '');
}

require.extensions['.wasm'] = function (module, filename) {
  const bin = require('fs').readFileSync(module.filename);
  const m = new WebAssembly.Module(bin);
  const wasmExports = WebAssembly.Module.exports(m);
  const wasmImports = WebAssembly.Module.imports(m);
  const { dirname } = require("path");

  let code = `
    const { join } = require("path");
    const { readFileSync } = require("fs");
    const bin = readFileSync("${module.filename}");
    const m = new WebAssembly.Module(bin);
    const wasmimports = {
      "env": {
        "now": Date.now
      }
    };
    const jsimports = {};
  `;
  code += generateImports(wasmImports, dirname(filename));
  code += `const wasminstance = new WebAssembly.Instance(m, wasmimports);\n`;
  code += generateExports(wasmExports);
  return module._compile(code, filename);
};
