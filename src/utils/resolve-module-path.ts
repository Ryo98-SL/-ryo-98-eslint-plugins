import ts from "typescript";

export const resolveModulePath = (moduleName: string, program: ts.Program): string | undefined => {
    const compilerOptions = program.getCompilerOptions();
    const moduleResolutionHost: ts.ModuleResolutionHost = {
        fileExists: ts.sys.fileExists,
        readFile: ts.sys.readFile,
        realpath: ts.sys.realpath,
        getCurrentDirectory: () => program.getCurrentDirectory(),
        getDirectories: ts.sys.getDirectories,
        useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames
    };
    const resolved = ts.resolveModuleName(
        moduleName,
        // 使用当前文件作为参考点
        program.getSourceFiles()[0].fileName,
        compilerOptions,
        moduleResolutionHost
    );

    return resolved.resolvedModule?.resolvedFileName;
};