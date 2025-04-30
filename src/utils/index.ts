import {AST_NODE_TYPES, type TSESTree} from "@typescript-eslint/typescript-estree";


import ts, {SyntaxKind} from 'typescript';
import {resolveModulePath} from "./resolve-module-path.ts";
import {TsService, TypedRuleContext} from "./types.ts";
import {findIntrinsicElementsInterface, findParentNode} from "./pin.ts";


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
                                    const parameters = signatures[0].getParameters();
                                    const propsSymbol = parameters[0];

                                    const propsType = tsChecker.getTypeOfSymbol(propsSymbol);

                                    if (propsType) {
                                        // 查找特定属性
                                        const property = propsType.getProperty(propName);
                                        if (property) {
                                            thatType = tsChecker.getTypeOfSymbol(property);
                                            console.log('& union',thatType.flags & ts.TypeFlags.Union);

                                            console.log('check type:', tsChecker.typeToString(
                                                thatType
                                            ))

                                            if(thatType.flags & ts.TypeFlags.Union) {
                                                (thatType as ts.UnionType).types.forEach((subType) => {
                                                    console.log('!!subType.symbol.valueDeclaration', tsChecker.typeToString(
                                                            subType
                                                        )
                                                        , !!subType.symbol?.valueDeclaration)
                                                })
                                            }


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



export const SetStateTypeStringPattern = /Dispatch<SetStateAction<.*>>/
export const RefPattern = /(RefObject|MutableRefObject)<.*>/

export * from './pin.ts';
export * from './resolve-module-path.ts';
export * from './format-output.ts';
export * from './types.ts';
export * from './process-config.ts';
export * from './resolve-imports.ts';
export * from './module-info.ts';
export * from './test.ts';