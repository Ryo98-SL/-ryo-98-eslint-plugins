// 辅助函数来查找 IntrinsicElements 接口
import {Scope} from "@typescript-eslint/utils/ts-eslint";
import {AST_NODE_TYPES, type TSESTree} from "@typescript-eslint/typescript-estree";
import {MapNodeWithTypes, ModuleInfo, TsService} from "./types.ts";
import ts from "typescript";
import {isNodeDescendant} from "./index.ts";

export function findIntrinsicElementsInterface(sourceFile: ts.SourceFile, checker: ts.TypeChecker): ts.InterfaceDeclaration | null {
    // 这部分需要递归遍历 AST 来找到 JSX 命名空间和 IntrinsicElements 接口
    // 大致逻辑如下:
    let result: ts.InterfaceDeclaration | null = null;

    function visit(node: ts.Node) {
        if (ts.isModuleDeclaration(node) && node.name.text === 'JSX') {

            // 找到 JSX 命名空间
            ts.forEachChild(node, child => {
                if (ts.isModuleBlock(child)) {
                    ts.forEachChild(child, (_blockChild) => {
                        if (ts.isInterfaceDeclaration(_blockChild) && _blockChild.name.text === 'IntrinsicElements') {
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

/**
 * Find JSX element that owns the attribute
 */
export const findParentNode = <T extends AST_NODE_TYPES | readonly AST_NODE_TYPES[]>(node: TSESTree.Node, types: T, shouldContinue?: (current: TSESTree.Node) => any): MapNodeWithTypes<T> | null => {
    let current: TSESTree.Node | null = node;

    let _types: readonly AST_NODE_TYPES[];
    if (typeof types === 'string') {
        _types = [types];
    } else {
        _types = types
    }

    while (current && (!_types.includes(current.type) || (shouldContinue && shouldContinue(current)))) {
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


export const findSymbolExportInfo = (symbol: ts.Symbol): ModuleInfo | undefined => {
    const declarations = symbol.getDeclarations();

    if (symbol.valueDeclaration) {
        const isNamedExport = ts.canHaveModifiers(symbol.valueDeclaration) && !!symbol.valueDeclaration.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);

        if (isNamedExport) {
            return {
                isDefaultExport: false,
                moduleName: symbol.valueDeclaration.getSourceFile().fileName
            }
        }
    }

    if (declarations && declarations.length > 0) {
        for (const declaration of declarations) {
            const sourceFile = declaration.getSourceFile();
            let moduleName = sourceFile.moduleName || sourceFile.fileName;

            const matchedDeps = moduleName.match(DependencyExpReg);

            if(matchedDeps) {
               moduleName = matchedDeps[1].slice(1);
            }


            const found = ts.forEachChild(sourceFile, child => {

                if (ts.canHaveModifiers(child)
                    && !!child.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
                    && 'name' in child
                    && child.name?.getText() === symbol.getName()
                ) {
                    return 'namedExport'
                } else if (ts.isExportAssignment(child) && ts.isIdentifier(child.expression) && (console.log(child.expression.text, symbol.getName()) , child.expression.text === symbol.getName())) {

                    return 'defaultExport'
                } else if (ts.isExportDeclaration(child) && child.exportClause && ts.isNamedExports(child.exportClause) && child.exportClause.elements.find(el => el.name.text === symbol.getName())) {
                    return 'namedExport'
                }
            });


            if (found) return {
                isDefaultExport: found === 'defaultExport',
                moduleName
            };
        }
    }

    return undefined;
}
export const findScopedVariable = (variableName: string, scope: Scope.Scope) => {
    let current: Scope.Scope | null = scope;
    while (current) {
        const found = current.variables.find(v => v.name === variableName);
        if (found) return found;

        current = current!.upper
    }


}
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
            if (ts.isShorthandPropertyAssignment(_node)) {
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

const DependencyExpReg = /node_modules((\/@[^/]+)?(\/[^@/]+))/;