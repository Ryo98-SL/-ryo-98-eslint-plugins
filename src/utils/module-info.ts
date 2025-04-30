import ts from "typescript";
import {ModuleInfo, TsService} from "./types.ts";

/**
 * 从类型中获取模块信息
 * @param type - 要获取模块信息的 TypeScript 类型
 * @returns 包含模块名称和导出类型的信息，如果不是从外部模块导入则返回 undefined
 */
export function getModuleInfoFromType(type: ts.Type, tsService: TsService, tsChecker: ts.TypeChecker): ModuleInfo | undefined {
    // 获取类型的符号
    const symbol = type.getSymbol() || type.aliasSymbol;
    if (!symbol) {
        return undefined;
    }

    // 获取符号的声明
    const declarations = symbol.getDeclarations();

    if (!declarations || declarations.length === 0) {

        return undefined;
    }


    // 取第一个声明分析模块信息
    const declaration = declarations[0];

    let declarationSourceFile = declaration.getSourceFile();
    // 如果是从其他文件导入的
    if (declarationSourceFile) {
        // 检查是否是默认导出
        let isDefaultExport = false;

        // 检查导出修饰符
        if (ts.canHaveModifiers(declaration)) {
            const modifiers = ts.getModifiers(declaration);
            isDefaultExport = modifiers?.some(mod => mod.kind === ts.SyntaxKind.DefaultKeyword) || false;
        }

        // 检查是否是输出声明的一部分（例如 export default class MyClass {}）
        if (!isDefaultExport && declaration.parent) {
            if (ts.isExportAssignment(declaration.parent)) {
                isDefaultExport = true;
            } else if (ts.isExportDeclaration(declaration.parent)) {
                // 检查是否在导出声明中指定为默认
                const exportDecl = declaration.parent as ts.ExportDeclaration;
                if (exportDecl.isTypeOnly === false &&
                    exportDecl.exportClause &&
                    ts.isNamedExports(exportDecl.exportClause)) {
                    // 在命名导出中查找匹配的导出说明符
                    const exportSpecifier = exportDecl.exportClause.elements.find(
                        spec => spec.name.text === symbol.getName() && spec.isTypeOnly === false
                    );

                    if (exportSpecifier && exportSpecifier.propertyName &&
                        exportSpecifier.propertyName.text === "default") {
                        isDefaultExport = true;
                    }
                }
            }
        }

        // 获取模块名称
        let moduleName: string | undefined;

        // 尝试从 import 语句中获取模块名称
        if (ts.isImportSpecifier(declaration)) {
            const importClause = declaration.parent?.parent?.parent;
            if (importClause && ts.isImportDeclaration(importClause)) {
                if (ts.isStringLiteral(importClause.moduleSpecifier)) {
                    moduleName = importClause.moduleSpecifier.text;
                }
            }
        }
        // 尝试从导出声明中获取模块名称
        else if (ts.isExportDeclaration(declaration.parent)) {
            const exportDecl = declaration.parent as ts.ExportDeclaration;
            if (exportDecl.moduleSpecifier && ts.isStringLiteral(exportDecl.moduleSpecifier)) {
                moduleName = exportDecl.moduleSpecifier.text;
            }
        }
        // 从声明文件路径获取模块名称
        else {
            // 获取声明文件的相对路径，并将其转换为模块名称
            const fileName = declarationSourceFile.fileName;
            // 处理不同类型的声明文件
            // node_modules 中的 d.ts 文件
            if (fileName.includes('node_modules')) {
                const nodeModulesIndex = fileName.indexOf('node_modules');
                const pathAfterNodeModules = fileName.substring(nodeModulesIndex + 'node_modules/'.length);
                // 从路径中提取包名
                const packagePathParts = pathAfterNodeModules.split('/');

                // 处理 @types 声明
                if (packagePathParts[0] === '@types') {
                    moduleName = packagePathParts[1];
                }
                // 处理带有 @ 作为前缀的声明 (例如 @angular/core)
                else if (packagePathParts[0].startsWith('@')) {
                    moduleName = `${packagePathParts[0]}/${packagePathParts[1]}`;
                }
                // 普通包
                else {
                    console.log("=>(utils.ts:760) ",);
                    moduleName = packagePathParts[0];
                }
            }
            // 项目内部的声明文件
            else {
                moduleName = fileName;
                // 将绝对路径转换为相对路径（根据项目结构可能需要调整）
                const baseDir = process.cwd();
                if (fileName.startsWith(baseDir)) {
                    moduleName = './' + moduleName.substring(baseDir.length + 1);
                }
            }
        }

        if (moduleName) {
            return {
                moduleName,
                isDefaultExport
            };
        }
    }

    return undefined;
}