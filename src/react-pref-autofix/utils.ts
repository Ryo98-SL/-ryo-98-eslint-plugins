import type {RuleContext, RuleFix, RuleFixer} from '@typescript-eslint/utils/ts-eslint';
import path from "path";
import fs from "fs";
import {
    AST_NODE_TYPES,
    type ParserServicesWithTypeInformation,
    type TSESTree
} from "@typescript-eslint/typescript-estree";


import ts, {
    ExportAssignment,
    type NamedImports,
    ObjectFlags,
    SymbolFlags,
    SyntaxKind,
    TypeChecker,
    TypeFlags
} from 'typescript';
import {fileURLToPath} from "node:url";
import {ScopeManager} from '@typescript-eslint/scope-manager';

export interface PluginOptions {
    typeDefinitions?: boolean;
    shortComponentNameThreshold?: number;
    ignoredComponents?: (string | RegExpConfig)[];
    declarationsPosition?: 'start' | 'end';
    checkFunction?: boolean;
    checkArray?: boolean;
    checkReturnValueOfCalling?: boolean;
    checkNewExpression?: boolean;
    checkRegExp?: boolean;
}

interface RegExpConfig {
    pattern: string;
    flags?: string;
}


/**
 * Check if component name should be ignored
 * @param componentName - Component name
 * @param ignoredComponentsExact - Set of exact component names to ignore
 * @param ignoredComponentsRegex - Array of regex patterns to check
 * @returns true if component should be ignored
 */
export function shouldIgnoreComponent(
    componentName: string,
    ignoredComponentsExact: Set<string>,
    ignoredComponentsRegex: RegExp[]
): boolean {
    // Check exact match
    if (ignoredComponentsExact.has(componentName)) {
        return true;
    }

    // Check regex match
    for (const regex of ignoredComponentsRegex) {
        if (regex.test(componentName)) {
            return true;
        }
    }

    return false;
}

export type TsService = ParserServicesWithTypeInformation;

/**
 * Get property type from TS compiler
 * @param node - JSX attribute node
 * @param propName - Property name
 * @param tsService - TypeScript service
 * @param filename - File name
 * @returns Type string
 */
const getTypeFromTsCompiler = (
    node: TSESTree.Node,
    propName: string,
    tsService: TsService | null,
    filename: string
): ts.Type | null => {
    let thatType: ts.Type | null = null;

    if (!tsService) return thatType;

    const tsChecker = tsService.program.getTypeChecker();

    try {
        if (node.type === AST_NODE_TYPES.JSXAttribute && node.value?.type === AST_NODE_TYPES.JSXExpressionContainer) {

            const jsxElement = findParentNode(node, AST_NODE_TYPES.JSXElement);
            if (jsxElement) {

                if (jsxElement.openingElement.name.type === AST_NODE_TYPES.JSXIdentifier) {
                    const tagName = jsxElement.openingElement.name.name;
                    if(tagName.match(/^[a-z]/)) {


                        const reactTypesPath = resolveModulePath('react', tsService.program);
                        if (reactTypesPath) {
                            const sourceFile = tsService.program.getSourceFile(reactTypesPath);
                            if (sourceFile) {
                                const IntrinsicElements = findIntrinsicElementsInterface(sourceFile, tsChecker);
                                const propertySignature = IntrinsicElements?.members.find(member => {
                                    if (member.kind === SyntaxKind.PropertySignature && member.name) {
                                        return member.name.getText() === tagName
                                    }
                                });

                                if (ts.isPropertySignature(propertySignature!) && propertySignature.type) {
                                    const propSymbol = tsChecker.getTypeAtLocation(propertySignature.type).getProperties().find(prop => {
                                        return prop.name === propName
                                    });


                                    const propType = tsChecker.getTypeOfSymbol(propSymbol!);



                                    thatType = propType;
                                }
                            }
                        }
                    } else {

                        const program = tsService.program;
                        const sourceFile = program.getSourceFile(filename);

                        if (sourceFile) {
                            // 尝试在当前作用域查找组件的符号
                            const symbol = tsService.getSymbolAtLocation(jsxElement.openingElement.name);
                            if (symbol) {
                                // 获取组件类型
                                const componentType = tsChecker.getTypeOfSymbol(symbol);

                                // 查找签名（例如函数调用签名）
                                const signatures = componentType.getCallSignatures();
                                if (signatures.length > 0) {
                                    // 获取第一个参数（props）的类型
                                    const propsSymbol = signatures[0].getParameters()[0];

                                    const propsType = tsChecker.getTypeOfSymbol(propsSymbol);
                                    if (propsType) {
                                        // 查找特定属性
                                        const property = propsType.getProperty(propName);
                                        if (property) {
                                            thatType = tsChecker.getTypeOfSymbol(property);
                                        }
                                    }
                                }
                            }
                        }

                    }
                }



            }
        }

    } catch (e) {
        console.warn('get type failed', e);
    }

    return thatType
};





const resolveModulePath = (moduleName: string, program: ts.Program): string | undefined => {
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

// 辅助函数来查找 IntrinsicElements 接口
function findIntrinsicElementsInterface(sourceFile: ts.SourceFile, checker: ts.TypeChecker): ts.InterfaceDeclaration | null {
    // 这部分需要递归遍历 AST 来找到 JSX 命名空间和 IntrinsicElements 接口
    // 大致逻辑如下:
    let result: ts.InterfaceDeclaration | null = null;

    function visit(node: ts.Node) {
        if (ts.isModuleDeclaration(node) && node.name.text === 'JSX') {

            // 找到 JSX 命名空间
            ts.forEachChild(node, child => {
                if(ts.isModuleBlock(child)) {
                    ts.forEachChild(child, (_blockChild) => {
                        if(ts.isInterfaceDeclaration(_blockChild) && _blockChild.name.text === 'IntrinsicElements') {
                            result = _blockChild;
                            return;
                        }
                    })
                }
            });
        }

        if (!result) {
            ts.forEachChild(node, visit);
        }
    }

    visit(sourceFile);
    return result;
}

type TypedRuleContext = Readonly<RuleContext<string, [{}]>>;

/**
 * Extract type information for component props
 * @param node - JSX attribute node
 * @param propName - Property name
 * @param componentName - Component name
 * @param isTypeScriptFile - Whether the file is a TypeScript file
 * @param shouldAddTypes - Whether to add type definitions
 * @param tsService - TypeScript service
 * @param filename - File name
 * @param context - ESLint context
 * @returns Type annotation
 */
export const getTypeNodeForProp = (
    node: any,
    propName: string,
    componentName: string,
    isTypeScriptFile: boolean,
    shouldAddTypes: boolean,
    tsService: TsService | null,
    filename: string,
    context:  TypedRuleContext
): ts.Type | null => {
    // If not a TypeScript file or no type definitions needed, return empty string
    if (!isTypeScriptFile || !shouldAddTypes) {
        return null;
    }


    // 4. Default to Record type
    return getTypeFromTsCompiler(node, propName, tsService, filename);
};

/**
 * Get component name from JSX element
 * @param jsxElement - JSX element node
 * @returns Component name
 */
export const getComponentName = (jsxElement: any): string => {
    if (!jsxElement || !jsxElement.name) {
        return 'Component';
    }

    if (jsxElement.name.type === 'JSXIdentifier') {
        return jsxElement.name.name;
    } else if (jsxElement.name.type === 'JSXMemberExpression') {
        // Handle cases like Namespace.Component
        return jsxElement.name.property.name;
    }

    return 'Component';
};

/**
 * Extract component name from className attribute
 * @param jsxElement - JSX element node
 * @returns Component name from className or null
 */
export const getComponentNameFromClassName = (jsxElement: any): string | null => {
    const attributes = jsxElement.attributes || [];

    for (const attr of attributes) {
        if (
            attr.type === 'JSXAttribute' &&
            attr.name.name === 'className' &&
            attr.value
        ) {
            // Handle string literals
            if (attr.value.type === 'Literal' && typeof attr.value.value === 'string') {
                const className = attr.value.value;
                const firstWord = className.split(/\s+/)[0];
                if (firstWord && firstWord.length > 0) {
                    // Capitalize first letter
                    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
                }
            }
            // Handle expression containers with string literals
            else if (
                attr.value.type === 'JSXExpressionContainer' &&
                attr.value.expression.type === 'Literal' &&
                typeof attr.value.expression.value === 'string'
            ) {
                const className = attr.value.expression.value;
                const firstWord = className.split(/\s+/)[0];
                if (firstWord && firstWord.length > 0) {
                    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
                }
            }
        }
    }

    return null;
};

type MapNodeUtil <N extends TSESTree.Node, T extends AST_NODE_TYPES> = N extends {type: T} ? N : never;

type MapNodeWithType<T extends AST_NODE_TYPES> = {
    [K in T]: MapNodeUtil<TSESTree.Node, K>
}[T];

type MapNodeWithTypes<T extends AST_NODE_TYPES | (readonly AST_NODE_TYPES[])> = T extends AST_NODE_TYPES ?
    MapNodeWithType<T>
    : T extends readonly AST_NODE_TYPES[] ? MapNodeWithType<T[number]> : never;


/**
 * Find JSX element that owns the attribute
 */
export const findParentNode = <T extends AST_NODE_TYPES | readonly AST_NODE_TYPES[]>(node: TSESTree.Node, types: T): MapNodeWithTypes<T> | null => {
    let current: TSESTree.Node | null = node;

    let _types: readonly AST_NODE_TYPES[];
    if(typeof types === 'string') {
        _types = [types];
    } else {
        _types = types
    }

    while (current && !_types.includes(current.type)) {
        current = current.parent || null;
    }

    //@ts-ignore
    return current || null;
};

/**
 * Find insert position at file start (after import statements)
 * @param programNode - Program node
 * @returns Insert position
 */
export const findStartInsertPosition = (programNode: any): number => {
    // Find position after last import statement
    const imports = programNode.body.filter((n: any) => n.type === 'ImportDeclaration');
    return imports.length > 0
        ? imports[imports.length - 1].range[1]
        : programNode.range[0];
};

/**
 * Find insert position at file end
 * @param programNode - Program node
 * @returns Insert position
 */
export const findEndInsertPosition = (programNode: any): number => programNode.range[1];

/**
 * Generate PascalCase variable name based on component and property names
 * @param componentName - Component name
 * @param propName - Property name
 * @param existingConstants - Map of existing constants
 * @returns Generated variable name
 */
export const generateVariableName = (
    sourceNode: TSESTree.Node,
    tsService: TsService,
    componentName: string,
    propName: string,
    capitalLower?: boolean,
): string => {
    // Convert property name to PascalCase

    let propNamePascal = propName
        .split(/[-_]/)
        .map((part, index) => part.charAt(0)['toUpperCase']() + part.slice(1))
        .join('');

    // Ensure first letter is uppercase
    propNamePascal = propNamePascal.charAt(0).toUpperCase() + propNamePascal.slice(1);

    if(capitalLower) {
        componentName = componentName[0].toLowerCase() + componentName.slice(1);
    }

    // Combine to create ComponentNamePropName format
    let baseName = `${componentName}${propNamePascal}`;

    const scopedVariables = tsService.program.getTypeChecker().getSymbolsInScope(
        tsService.esTreeNodeToTSNodeMap.get(sourceNode),
        SymbolFlags.BlockScopedVariable
    ).map(s => s.name);

    // Check for name conflicts, add numeric suffix if needed
    let finalName = baseName;
    let count = 1;

    while (scopedVariables.includes(finalName)) {
        finalName = `${baseName}${count}`;
        count++;
    }

    return finalName;
};


/**
 * Process ignored components configuration
 * @param ignoredComponentsConfig - Configuration for ignored components
 * @returns Object with sets of ignored components
 */
export const processIgnoredComponentsConfig = (ignoredComponentsConfig: (string | RegExpConfig)[]): {
    ignoredComponentsExact: Set<string>;
    ignoredComponentsRegex: RegExp[];
} => {
    const ignoredComponentsExact = new Set<string>();
    const ignoredComponentsRegex: RegExp[] = [];

    ignoredComponentsConfig.forEach(config => {
        if (typeof config === 'string') {
            // Add string directly to exact match set
            ignoredComponentsExact.add(config);
        } else if (config && (config as RegExpConfig).pattern) {
            // Convert object config to RegExp
            try {
                const regexConfig = config as RegExpConfig;
                const regex = new RegExp(regexConfig.pattern, regexConfig.flags || '');
                ignoredComponentsRegex.push(regex);
            } catch (e) {
                // Invalid regex config, log warning
                console.warn(`Invalid regex pattern in ignoredComponents: ${(config as RegExpConfig).pattern}`);
            }
        }
    });

    return {ignoredComponentsExact, ignoredComponentsRegex};
};



type DeclarationNodeType = TSESTree.VariableDeclarator | TSESTree.FunctionDeclaration | TSESTree.ClassDeclaration


export const findReferenceUsagesInScope = (
    tsServices: TsService,
    node: TSESTree.Node
) => {
    const tsNode = tsServices.esTreeNodeToTSNodeMap.get(node);

    const outerReferences = new Set<ts.Symbol>();
    const tsChecker = tsServices.program.getTypeChecker();

    function analyzeIdentifiers(_node: ts.Node) {
        if (ts.isIdentifier(_node) || ts.isShorthandPropertyAssignment(_node)) {
            // 获取标识符的符号
            let symbol: ts.Symbol | undefined;
            if(ts.isShorthandPropertyAssignment(_node)) {
                symbol = tsChecker.getShorthandAssignmentValueSymbol(_node)
            } else {
                symbol = tsChecker.getSymbolAtLocation(_node)
            }

            if (symbol) {
                const valueDeclaration = symbol.valueDeclaration;
                if (valueDeclaration) {

                    // 检查声明是否在箭头函数外部
                    if (!isNodeDescendant(valueDeclaration, tsNode)) {
                        // 这是一个外部引用
                        outerReferences.add(symbol);
                    }
                }
            }
        }

        ts.forEachChild(_node, analyzeIdentifiers);
    }

    analyzeIdentifiers(tsNode);

    return outerReferences;
};

function isFromLib(symbol: ts.Symbol): boolean {
    if (!symbol.valueDeclaration) return false;

    const fileName = symbol.valueDeclaration.getSourceFile().fileName;
    return fileName.includes("lib.") && fileName.includes(".d.ts");
}

export const isNodeDescendant = (node: ts.Node, potentialAncestor: ts.Node): boolean => {
    let current: ts.Node | undefined = node.parent;
    while (current) {
        if (current === potentialAncestor) {
            return true;
        }
        current = current.parent;
    }
    return false;
};

export const isNodeDescendantWithKind = <T extends SyntaxKind>(node: ts.Node, kind: T): null | ts.Node => {
    let current: ts.Node | undefined = node.parent;
    while (current) {
        if (current.kind === kind) {
            return current;
        }
        current = current.parent;
    }

    return null
};


const isBindingNameNode = (node: TSESTree.Node): node is TSESTree.BindingName => {
    return node.type === AST_NODE_TYPES.ObjectPattern || node.type === AST_NODE_TYPES.ArrayPattern || node.type === AST_NODE_TYPES.Identifier;
}

const valueDeclarationHasName = (bindingNameNode: TSESTree.BindingName, name: string): boolean => {
    const id = bindingNameNode;
    let match = false;

    if(id.type === AST_NODE_TYPES.ArrayPattern) {
        for (const element of id.elements) {
            if(!element) continue;
            match = isBindingNameNode(element) ? valueDeclarationHasName(element, name) : false;
            if(match) break;
        }

    } else if(id.type === AST_NODE_TYPES.ObjectPattern) {
        for (const property of id.properties) {
            if(property.value) {
                match = isBindingNameNode(property.value) ? valueDeclarationHasName(property.value, name) : false;
            } else {
                match = property.type === AST_NODE_TYPES.Property && isBindingNameNode(property.key) ? valueDeclarationHasName(property.key, name) : false;
            }

            if(match) break;
        }

    } else {
        match = id.name === name;
    }

    return match;
};



// 在每行添加额外的空格（通过操作原始代码）
export const addIndentationToEachLine = (code: string, spacesToAdd: number = 2, ignoreBeginning = true): string => {
    const spaces = ' '.repeat(spacesToAdd);
    const strings = code.split('\n');

    return strings.map((line, index) => (index === 0 && ignoreBeginning ? '' : spaces) + line).join('\n');
};


const ExampleDirPath = path.join(fileURLToPath(import.meta.url), '../examples');

function readTestFile (subPath: string)  {
    return fs.readFileSync(path.resolve(ExampleDirPath, subPath)).toString()
}
export function getTestData (index: number)  {

    return {
        content: [
            readTestFile(`./test-${index}/in.tsx`),
            readTestFile(`./test-${index}/out.tsx`),
        ],
        ExampleDirPath,
        fixPath: path.resolve(ExampleDirPath, `./test-${index}/out.tsx`)
    }
}


/**
 * 从类型中获取模块信息
 * 此函数需要根据您的实际实现提供
 */
interface ModuleInfo {
    moduleName: string;
    isDefaultExport?: boolean;
}
/**
 * 从类型中获取模块信息
 * @param type - 要获取模块信息的 TypeScript 类型
 * @returns 包含模块名称和导出类型的信息，如果不是从外部模块导入则返回 undefined
 */
function getModuleInfoFromType(type: ts.Type, tsService: TsService, tsChecker: ts.TypeChecker  ): ModuleInfo | undefined {
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
                    console.log("=>(utils.ts:760) ", );
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

/**
 * 导入声明更新结果接口，包含原始声明和新的声明
 */
export interface ImportUpdateResult {
    /** 原始的导入声明，如果是新创建的则为null */
    originalDeclaration: ts.ImportDeclaration | null;
    /** 更新后或新创建的导入声明 */
    newDeclaration: ts.ImportDeclaration;
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

        if (symbol && (!tsChecker.isArrayType(type) || type.aliasSymbol) ) {

            let moduleInfo: ModuleInfo | undefined;
            if(type.aliasSymbol) {
                moduleInfo = findSymbolExportInfo(type.aliasSymbol);
            } else {
                moduleInfo = getModuleInfoFromType(type, tsService, tsChecker);
            }

            if (moduleInfo && moduleInfo.moduleName && moduleInfo.moduleName !== sourceFile.fileName && moduleInfo.moduleName !== 'typescript') {

                let _moduleName: string;
                const moduleDir = path.dirname(sourceFile.fileName);
                if(resolveToRelativePath && path.isAbsolute(moduleInfo.moduleName)) {
                    _moduleName = path.relative(moduleDir, moduleInfo.moduleName).replace(/\\/g, '/');
                    if(!_moduleName.startsWith('./')) {
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
                }  );



                if(!type.aliasSymbol && !isInterfaceType) {
                    return;
                }


                const typeName = type.aliasSymbol ? type.aliasSymbol.getName() : type.symbol.getName();
                if(!typeName) return;
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
            if(resolvedModulePath) {
                existingImports.set(resolvedModulePath, statement)
            } else {
                existingImports.set(path.resolve(dirname, statement.moduleSpecifier.text).replace(/\\/g, '/'), statement);
            }
        }
    }

    const moduleNameToAbsolute = (name: string) => {
        const resolvedModuleName = resolveModulePath(name, program);
        if(resolvedModuleName) {
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
    const existingImport = findExistingImport( modulePath, sourceFile, program);

    // 创建导入说明符
    const importSpecifier = factory.createImportSpecifier(
        false,
        undefined,
        factory.createIdentifier(entityName)
    );

    let defaultImport: ts.Identifier | undefined;
    let namedImports: NamedImports | undefined;

    if(isDefaultImport) {
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
function findExistingImport(modulePath: string,sourceFile: ts.SourceFile, progrom: ts.Program): ts.ImportDeclaration | null {

    for (const statement of sourceFile.statements) {
        if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {

            const resolvedModulePath = resolveModulePath(modulePath,progrom) || modulePath;
            const resolvedExistPath = resolveModulePath(statement.moduleSpecifier.text, progrom);
            if (resolvedExistPath === resolvedModulePath) {
                return statement;
            }
        }
    }
    return null;
}

/**
 * 表示导入更新的结果
 */
export interface ImportUpdateResult {
    originalDeclaration: ts.ImportDeclaration | null;
    newDeclaration: ts.ImportDeclaration;
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
            if(result.originalDeclaration) {
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

const isTypeUsable = (
    sourceFile: ts.SourceFile,
    typeName: string,
    program: ts.Program
): {
    isAvailable: boolean;
    importInfo?: { moduleSpecifier: string; isDefault: boolean };
} => {
    const checker = program.getTypeChecker();

    // 1. 检查全局类型
    const globalSymbol = checker.getSymbolAtLocation(
        ts.factory.createIdentifier(typeName)
    );
    if (globalSymbol) {
        return { isAvailable: true };
    }

    // 2. 检查导入的类型
    for (const statement of sourceFile.statements) {
        if (!ts.isImportDeclaration(statement)) continue;

        const moduleSpecifier = (statement.moduleSpecifier as ts.StringLiteral).text;
        const importClause = statement.importClause;
        if (!importClause) continue;

        // 检查默认导入
        if (importClause.name && importClause.name.text === typeName) {
            return {
                isAvailable: true,
                importInfo: { moduleSpecifier, isDefault: true }
            };
        }

        // 检查命名导入
        if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
            for (const element of importClause.namedBindings.elements) {
                if (element.name.text === typeName) {
                    return {
                        isAvailable: true,
                        importInfo: { moduleSpecifier, isDefault: false }
                    };
                }
            }
        }

        // 检查命名空间导入
        if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
            const namespaceName = importClause.namedBindings.name.text;
            const namespaceSymbol = checker.getSymbolAtLocation(
                ts.factory.createIdentifier(namespaceName)
            );
            if (namespaceSymbol) {
                const exports = checker.getExportsOfModule(namespaceSymbol);
                if (exports.some(e => e.getName() === typeName)) {
                    return {
                        isAvailable: true,
                        importInfo: { moduleSpecifier, isDefault: false }
                    };
                }
            }
        }
    }

    return { isAvailable: false };
};



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
                    fixer.insertTextBeforeRange([0,0], newImportText)
                )
            }
        }

    })
}

export type FixScene = 'top-level-constant' | 'hook';

export const getConstDeclarationText = (
    tsExpression: ts.FunctionExpression | ts.ObjectLiteralExpression,
    variableName: string,
    type: ts.Type | undefined | null,
    printer: ts.Printer,
    sourceFile: ts.SourceFile | undefined,
    tsChecker: ts.TypeChecker) => {

    const typeNode = type ? tsChecker.typeToTypeNode(type, undefined, undefined) : undefined;

    const variableDeclaration = ts.factory.createVariableDeclaration(variableName, undefined, typeNode, tsExpression);

    const variableDeclarationList = ts.factory.createVariableDeclarationList([variableDeclaration], ts.NodeFlags.Const);
    const variableStatement = ts.factory.createVariableStatement(undefined, variableDeclarationList);
    let declarationString = printer.printNode(ts.EmitHint.Unspecified, variableStatement, sourceFile!);

    return {
        declaration: variableDeclarationList,
        text: '\n' + declarationString + '\n'
    };
};

export const getHookDeclarationText = (
    hookName: string,
    tsExpression: ts.FunctionExpression | ts.ObjectLiteralExpression,
    variableName: string,
    type: ts.Type | undefined | null,
    references: ts.Symbol[],
    printer: ts.Printer,
    sourceFile: ts.SourceFile | undefined,
    tsChecker: ts.TypeChecker
) => {



    let typeNode: ts.TypeNode | undefined = undefined;

    if(type?.isUnion() && hookName === 'useCallback') {
        const types = type.types.filter(_type => !!_type.getCallSignatures().length);

        typeNode = ts.factory.createUnionTypeNode( types.map(t => tsChecker.typeToTypeNode(t, undefined, undefined)).filter(t => !!t) );
    } else {
        typeNode = type ? tsChecker.typeToTypeNode(type, undefined, undefined) : undefined;
    }

    const identifier = ts.factory.createIdentifier(hookName);

    let firstExpress: ts.Expression;


    if(hookName === 'useMemo') {
        const returnSt = ts.factory.createReturnStatement(tsExpression);
        const bodyBlock = ts.factory.createBlock([
            returnSt
        ]);

        const wrapperArrowFnExpression = ts.factory.createArrowFunction(undefined, undefined, [], undefined, undefined, bodyBlock);

        firstExpress = wrapperArrowFnExpression
    } else {

        firstExpress = tsExpression;
    }

    const referencesIdentifiers = references.map(ref => {
        return ts.factory.createIdentifier(ref.name);
    })
    const depsArray = ts.factory.createArrayLiteralExpression(referencesIdentifiers);


    const hookExpression = ts.factory.createCallExpression(
        identifier,
        typeNode ? [typeNode] : typeNode,
        [
            firstExpress,
            depsArray
        ]
    );


    const variableDeclaration = ts.factory.createVariableDeclaration(variableName, undefined, undefined, hookExpression);
    const variableDeclarationList = ts.factory.createVariableDeclarationList([variableDeclaration], ts.NodeFlags.Const);

    const variableStatement = ts.factory.createVariableStatement(undefined, variableDeclarationList);

    let declarationString = printer.printNode(ts.EmitHint.Unspecified, variableStatement, sourceFile!);

    return {
        text: '\n' + declarationString + '\n',
        variableStatement
    }
}

const findSymbolExportInfo = (symbol: ts.Symbol): ModuleInfo | undefined => {
    const declarations = symbol.getDeclarations();

    if(symbol.valueDeclaration) {
        const isNamedExport = ts.canHaveModifiers(symbol.valueDeclaration) && !!symbol.valueDeclaration.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);

        if(isNamedExport) {
            return {
                isDefaultExport: false,
                moduleName: symbol.valueDeclaration.getSourceFile().fileName
            }
        }
    }

    if(declarations && declarations.length > 0) {
        for (const declaration of declarations) {
            const sourceFile = declaration.getSourceFile();
            const moduleName= sourceFile.moduleName || sourceFile.fileName;

            const found = ts.forEachChild(sourceFile, child => {

                if(ts.canHaveModifiers(child)
                    && !!child.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
                    && 'name' in child
                    && child.name?.getText() === symbol.getName()
                ) {
                    return 'namedExport'
                } else if(ts.isExportAssignment(child) && ts.isIdentifier(child.expression) && ( console.log(child.expression.text, symbol.getName()) ,child.expression.text === symbol.getName())) {
                    
                    return 'defaultExport'
                } else if(ts.isExportDeclaration(child) && child.exportClause && ts.isNamedExports(child.exportClause) && child.exportClause.elements.find(el => el.name.text === symbol.getName())) {
                    return 'namedExport'
                }
            });


            if(found) return {
                isDefaultExport: found === 'defaultExport',
                moduleName
            };
        }
    }

    return undefined;
}


export const SetStateTypeStringPattern = /Dispatch<SetStateAction<.*>>/
export const RefPattern = /(RefObject|MutableRefObject)<.*>/