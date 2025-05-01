import ts, {type NamedImports, ObjectFlags, SyntaxKind, TypeFlags} from "typescript";
import {ImportUpdateResult, ModuleInfo, TsService} from "./types.ts";
import type {RuleFix, RuleFixer} from "@typescript-eslint/utils/ts-eslint";
import {resolveModulePath} from "./resolve-module-path.ts";
import path from "path";
import {ScopeManager} from "@typescript-eslint/scope-manager";
import {findSymbolExportInfo} from "./pin.ts";

/**
 * 为指定的具名值创建导入声明
 * @param entityName 需要导入的具名值
 * @param modulePath 模块路径
 * @param sourceFile 源文件
 * @returns 包含原始声明和新声明的结果对象
 */
export function createImport(
    entityName: string,
    modulePath: string,
    isDefaultImport: boolean,
    sourceFile: ts.SourceFile,
    program: ts.Program
): ImportUpdateResult {
    const factory = ts.factory;

    // 查找现有导入声明
    const existingImport = findExistingImport(modulePath, sourceFile, program);

    // 创建导入说明符
    const importSpecifier = factory.createImportSpecifier(
        false,
        undefined,
        factory.createIdentifier(entityName)
    );

    let defaultImport: ts.Identifier | undefined;
    let namedImports: NamedImports | undefined;

    if (isDefaultImport) {
        defaultImport = factory.createIdentifier(entityName);
    } else {
        namedImports = factory.createNamedImports([importSpecifier]);
    }
    // 创建命名导入


    // 创建导入子句
    const importClause = factory.createImportClause(
        false,
        defaultImport,
        namedImports
    );

    // 创建导入声明
    const importDecl = factory.createImportDeclaration(
        undefined,
        importClause,
        factory.createStringLiteral(modulePath)
    );

    return {
        originalDeclaration: existingImport,
        newDeclaration: importDecl
    };
}

/**
 * 在源文件中查找指定模块路径的现有导入声明
 * @param sourceFile 源文件
 * @param modulePath 模块路径
 * @returns 找到的导入声明，如果不存在则返回null
 */
function findExistingImport(modulePath: string, sourceFile: ts.SourceFile, progrom: ts.Program): ts.ImportDeclaration | null {

    for (const statement of sourceFile.statements) {
        if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {

            const resolvedModulePath = resolveModulePath(modulePath, progrom) || modulePath;
            const resolvedExistPath = resolveModulePath(statement.moduleSpecifier.text, progrom);
            if (resolvedExistPath === resolvedModulePath) {
                return statement;
            }
        }
    }
    return null;
}

/**
 * 合并多个 ImportUpdateResult 中的 ImportDeclaration
 * @param results ImportUpdateResult 数组
 * @returns 合并后的 ImportUpdateResult 数组
 */
export function mergeImportUpdateResults(results: ImportUpdateResult[], dirname: string): ImportUpdateResult[] {
    const moduleMap = new Map<string, ImportUpdateResult>();

    for (const result of results) {
        const moduleSpecifier = ts.isStringLiteral(result.newDeclaration.moduleSpecifier)
            ? path.resolve(dirname, result.newDeclaration.moduleSpecifier.text)
            : '';

        if (!moduleMap.has(moduleSpecifier)) {
            if (result.originalDeclaration) {
                result.newDeclaration = mergeImportDeclarations(result.newDeclaration, result.originalDeclaration)
            }
            moduleMap.set(moduleSpecifier, result);
        } else {
            // 合并相同模块的导入声明
            const existingResult = moduleMap.get(moduleSpecifier)!;
            const mergedDeclaration = mergeImportDeclarations(
                existingResult.newDeclaration,
                result.newDeclaration
            );

            moduleMap.set(moduleSpecifier, {
                originalDeclaration: existingResult.originalDeclaration,
                newDeclaration: mergedDeclaration
            });
        }
    }

    return Array.from(moduleMap.values());
}

/**
 * 合并两个 ImportDeclaration
 * @param decl1 第一个 ImportDeclaration
 * @param decl2 第二个 ImportDeclaration
 * @returns 合并后的 ImportDeclaration
 */
function mergeImportDeclarations(
    decl1: ts.ImportDeclaration,
    decl2: ts.ImportDeclaration
): ts.ImportDeclaration {
    const factory = ts.factory;

    // 确保两个声明来自同一个模块
    const moduleSpecifier = decl1.moduleSpecifier;

    const clause1 = decl1.importClause;
    const clause2 = decl2.importClause;

    // 合并默认导入
    const defaultImport = clause1?.name || clause2?.name;

    // 合并命名绑定
    let namedBindings: ts.NamedImportBindings | undefined;

    if (clause1?.namedBindings && clause2?.namedBindings) {
        // 两个声明都有命名绑定
        if (ts.isNamespaceImport(clause1.namedBindings)) {
            // 优先保留命名空间导入
            namedBindings = clause1.namedBindings;
        } else if (ts.isNamespaceImport(clause2.namedBindings)) {
            namedBindings = clause2.namedBindings;
        } else {
            // 合并命名导入
            const names1 = ts.isNamedImports(clause1.namedBindings)
                ? clause1.namedBindings.elements.map(e => e.name.text)
                : [];
            const names2 = ts.isNamedImports(clause2.namedBindings)
                ? clause2.namedBindings.elements.map(e => e.name.text)
                : [];

            const uniqueNames = Array.from(new Set([...names1, ...names2]));
            const importSpecifiers = uniqueNames.map(name =>
                factory.createImportSpecifier(
                    false,
                    undefined,
                    factory.createIdentifier(name)
                )
            );

            namedBindings = factory.createNamedImports(importSpecifiers);
        }
    } else {
        namedBindings = clause1?.namedBindings || clause2?.namedBindings;
    }

    // 创建新的导入子句
    const newImportClause = (defaultImport || namedBindings)
        ? factory.createImportClause(
            clause1?.isTypeOnly || clause2?.isTypeOnly || false,
            defaultImport,
            namedBindings
        )
        : undefined;

    // 合并修饰符
    const modifiers = [...(decl1.modifiers || []), ...(decl2.modifiers || [])]
        .filter((m, i, arr) => arr.findIndex(mm => mm.kind === m.kind) === i);

    return factory.createImportDeclaration(
        modifiers.length > 0 ? modifiers : undefined,
        newImportClause,
        moduleSpecifier
    );
}

export const injectWithImport = (fixer: RuleFixer, fixes: RuleFix[], tsService: TsService, printer: ts.Printer, importUpdateResults?: ImportUpdateResult[], sourceFile?: ts.SourceFile) => {
    if (!sourceFile) {
        return;
    }

    importUpdateResults?.forEach((updateResult) => {
        const newImportText = printer.printNode(
            ts.EmitHint.Unspecified,
            updateResult.newDeclaration,
            sourceFile
        );

        if (updateResult.originalDeclaration) {
            const originImportDeclaration = tsService.tsNodeToESTreeNodeMap.get(updateResult.originalDeclaration);
            fixes.push(fixer.replaceText(originImportDeclaration, newImportText));
        } else {
            const lastImportStatement = sourceFile.statements.findLast(st => st.kind === SyntaxKind.ImportDeclaration)
            if (lastImportStatement) {
                const insertNodeOrToken = tsService.tsNodeToESTreeNodeMap.get(lastImportStatement);
                fixes.push(
                    fixer.insertTextAfter(insertNodeOrToken, '\n' + newImportText)
                )
            } else {
                fixes.push(
                    fixer.insertTextBeforeRange([0, 0], newImportText)
                )
            }
        }

    })
}

export function analyzeTypeAndCreateImports(
    typeToAnalyze: ts.Type,
    tsService: TsService,
    tsChecker: ts.TypeChecker,
    sourceFile: ts.SourceFile,
    program: ts.Program,
    scopeManager: ScopeManager,
    options?: { resolveToRelativePath?: boolean }
): ImportUpdateResult[] {
    const factory = ts.factory;
    const result: ImportUpdateResult[] = [];
    const typeModulesMap = new Map<string, Set<string>>();
    const defaultExportModulesMap = new Map<string, string>();
    const namespaceImportModulesMap = new Map<string, string>();

    const resolveToRelativePath = options?.resolveToRelativePath ?? true;

    // Recursive function to analyze types and collect imports
    function collectTypesToImport(type: ts.Type, visited = new Set<ts.Type>()) {

        if (visited.has(type)) return;
        visited.add(type);

        // Get type symbol
        const symbol = type.getSymbol() || type.aliasSymbol;

        if (symbol && (!tsChecker.isArrayType(type) || type.aliasSymbol)) {

            let moduleInfo: ModuleInfo | undefined;
            moduleInfo = findSymbolExportInfo(type.aliasSymbol || type.symbol);

            if (moduleInfo && moduleInfo.moduleName && moduleInfo.moduleName !== sourceFile.fileName && moduleInfo.moduleName !== 'typescript') {

                let _moduleName: string;
                const moduleDir = path.dirname(sourceFile.fileName);
                if (resolveToRelativePath && path.isAbsolute(moduleInfo.moduleName)) {
                    _moduleName = path.relative(moduleDir, moduleInfo.moduleName).replace(/\\/g, '/');
                    if (!_moduleName.startsWith('./')) {
                        _moduleName = './' + _moduleName;
                    }

                } else {
                    _moduleName = moduleInfo.moduleName;
                }

                const isInterfaceType = ((type.flags & TypeFlags.Object) && ((type as ts.ObjectType).objectFlags & ObjectFlags.Interface)) !== 0;

                console.log("=>(utils.ts:845) analyze type", {
                    moduleInfo,
                    isArrayType: tsChecker.isArrayType(type),
                    isInterfaceType,
                    aliasSymbol: type.aliasSymbol?.name,
                    typeString: tsChecker.typeToString(type)
                });


                if (!type.aliasSymbol && !isInterfaceType) {
                    return;
                }


                const typeName = type.aliasSymbol ? type.aliasSymbol.getName() : type.symbol.getName();
                if (!typeName) return;
                // Check if it's a default export
                if (symbol.escapedName === "default" || moduleInfo.isDefaultExport) {
                    defaultExportModulesMap.set(_moduleName, typeName);
                } else {
                    // Add to named imports
                    if (!typeModulesMap.has(_moduleName)) {
                        typeModulesMap.set(_moduleName, new Set<string>());
                    }
                    typeModulesMap.get(_moduleName)!.add(typeName);
                }
            }

        }

        // Handle union and intersection types
        if (!type.aliasSymbol && type.isUnionOrIntersection()) {
            type.types.forEach(t => collectTypesToImport(t, visited));
            return;
        }

        // Handle generic type parameters
        if (type.flags & ts.TypeFlags.Object && !type.aliasSymbol) {
            const objectType = type as ts.ObjectType;
            if (objectType.objectFlags & ts.ObjectFlags.Reference) {
                const typeReference = type as ts.TypeReference;
                if (typeReference.typeArguments) {
                    typeReference.typeArguments.forEach(typeArg => {
                        collectTypesToImport(typeArg, visited);
                    });
                }
            }
        }

        // Handle function types' parameters and return types
        if (type.getCallSignatures && type.getCallSignatures().length > 0) {
            type.getCallSignatures().forEach(signature => {
                signature.getParameters().forEach(param => {
                    const paramType = tsChecker.getTypeOfSymbolAtLocation(param, sourceFile);
                    collectTypesToImport(paramType, visited);
                });

                const returnType = signature.getReturnType();
                collectTypesToImport(returnType, visited);
            });
        }

        // Analyze property types
        if (type.isLiteral() && tsChecker.getPropertiesOfType(type).length > 0) {
            tsChecker.getPropertiesOfType(type).forEach(prop => {
                const propType = tsChecker.getTypeOfSymbolAtLocation(prop, sourceFile);
                collectTypesToImport(propType, visited);
            });
        }
    }


    // Start analyzing the type
    collectTypesToImport(typeToAnalyze);
    const dirname = path.dirname(sourceFile.fileName);


    // Get existing import declarations
    const existingImports = new Map<string | undefined, ts.ImportDeclaration>();
    for (const statement of sourceFile.statements) {
        if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
            const resolvedModulePath = resolveModulePath(statement.moduleSpecifier.text, program);
            if (resolvedModulePath) {
                existingImports.set(resolvedModulePath, statement)
            } else {
                existingImports.set(path.resolve(dirname, statement.moduleSpecifier.text).replace(/\\/g, '/'), statement);
            }
        }
    }

    const moduleNameToAbsolute = (name: string) => {
        const resolvedModuleName = resolveModulePath(name, program);
        if (resolvedModuleName) {
            return resolvedModuleName
        }

        return path.resolve(dirname, name).replace(/\\/g, '/');
    }

    // Process each module that needs imports
    // Handle default imports
    for (const [moduleName, importName] of defaultExportModulesMap.entries()) {
        const existingImport = existingImports.get(moduleNameToAbsolute(moduleName));

        // Create import clause with default import
        const importClause = factory.createImportClause(
            false,
            factory.createIdentifier(importName),
            undefined
        );

        // Create import declaration
        const importDecl = factory.createImportDeclaration(
            undefined,
            importClause,
            factory.createStringLiteral(moduleName)
        );

        result.push({
            originalDeclaration: existingImport || null,
            newDeclaration: importDecl
        });
    }

    // Handle namespace imports
    for (const [moduleName, importName] of namespaceImportModulesMap.entries()) {
        const existingImport = existingImports.get(moduleNameToAbsolute(moduleName));

        // Create namespace import
        const namespaceImport = factory.createNamespaceImport(
            factory.createIdentifier(importName)
        );

        // Create import clause with namespace import
        const importClause = factory.createImportClause(
            false,
            undefined,
            namespaceImport
        );

        // Create import declaration
        const importDecl = factory.createImportDeclaration(
            undefined,
            importClause,
            factory.createStringLiteral(moduleName)
        );

        result.push({
            originalDeclaration: existingImport || null,
            newDeclaration: importDecl
        });
    }

    // Handle named imports
    for (const [moduleName, typeNames] of typeModulesMap.entries()) {
        const existingImport = existingImports.get(moduleNameToAbsolute(moduleName));

        if (typeNames.size > 0) {
            // Create import specifiers for each named import
            const importSpecifiers = Array.from(typeNames).map(name =>
                factory.createImportSpecifier(
                    false,
                    undefined,
                    factory.createIdentifier(name)
                )
            );

            // Create named imports
            const namedImports = factory.createNamedImports(importSpecifiers);

            // Create import clause with named imports
            const importClause = factory.createImportClause(
                false,
                undefined,
                namedImports
            );

            // Create import declaration
            const importDecl = factory.createImportDeclaration(
                undefined,
                importClause,
                factory.createStringLiteral(moduleName)
            );

            result.push({
                originalDeclaration: existingImport || null,
                newDeclaration: importDecl
            });
        }
    }

    return result;
}