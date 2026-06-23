module.exports = {
  process(sourceText, sourcePath) {
    if (!sourcePath.endsWith('.ts')) {
      return { code: sourceText };
    }

    const ts = require('typescript');
    const result = ts.transpileModule(sourceText, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2021,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        sourceMap: true,
      },
      fileName: sourcePath,
    });

    return { code: result.outputText };
  },
};
