function trampoline(name, to) {
  return `(function ${name}(...args) { return ${to}(...args); })`;
}

function generateExports(exports) {
  return exports.reduce((code, e) => {
    return (
      code +
      `module.exports["${e.name}"] = ` +
      trampoline(e.name, `wasminstance.exports["${e.name}"]`) +
      ';\n'
    );
  }, '');
}

function generateImports(imports, basedir) {
  // keep track of module we imported in generated code
  const importedModule = {};

  return imports.reduce((code, imp) => {
    if (!importedModule[imp.module]) {
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

  let code = `
    const { join } = require("path");
    const { readFileSync } = require("fs");
    const bin = readFileSync("${module.filename}");
    const m = new WebAssembly.Module(bin);
    const wasmimports = {};
    const jsimports = {};
  `;
  code += generateImports(wasmImports, module.path);
  code += `const wasminstance = new WebAssembly.Instance(m, wasmimports);`;
  code += generateExports(wasmExports);
  console.log(code);
  return module._compile(code, filename);
};
