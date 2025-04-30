import {AST_NODE_TYPES, TSESTree} from "@typescript-eslint/typescript-estree";
import ts, {SymbolFlags} from "typescript";
import {TsService} from "./types.ts";

import {findParentNode} from "./pin.ts";

export const getPositionBetweenReturnAndSymbols = (
    body: TSESTree.BlockStatement,
    symbols: ts.Symbol[],
    tsService: TsService,
) => {
    let defaultIndent = 0;
    let end = 0;

    const returnSt = body.body.find(st => (st.type === AST_NODE_TYPES.ReturnStatement || st.type === AST_NODE_TYPES.ExpressionStatement));
    if (returnSt) {
        end = returnSt.range[0];
        defaultIndent = returnSt.loc.start.column;
    } else {
        end = body.range[1];
        defaultIndent = body.body[0]?.loc.start.column ?? 2;
    }


    const {
        end: insertPosition,
        indent
    } = symbols.reduce((info, symbol) => {
        const _pos = (symbol.valueDeclaration!).end;
        const parent = findParentNode(tsService.tsNodeToESTreeNodeMap.get(symbol.valueDeclaration!), [AST_NODE_TYPES.FunctionDeclaration, AST_NODE_TYPES.VariableDeclaration, AST_NODE_TYPES.ClassDeclaration]);


        if (info.end < _pos) {
            return {end: (parent?.range[1] ?? 0) + 1, indent: parent?.loc.start.column ?? 0}
        }

        return info;
    }, {end, indent: defaultIndent});


    return {
        insertPosition,
        indent
    }
}
export const transformFunctionWithNonBlockStatement = (
    fnNode: TSESTree.ArrowFunctionExpression,
    tsService: TsService,
    additionalVariableStatement: ts.VariableStatement,
) => {
    const fnCompNode = tsService.esTreeNodeToTSNodeMap.get(fnNode);
    const bodyNode = tsService.esTreeNodeToTSNodeMap.get(fnNode.body);

    const returnSt = ts.factory.createReturnStatement(bodyNode as ts.JsxElement);


    return ts.factory.createArrowFunction(
        fnCompNode.modifiers?.map(modifier => ts.factory.createModifier(modifier.kind)),
        fnCompNode.typeParameters,
        fnCompNode.parameters,
        fnCompNode.type,
        undefined,
        ts.factory.createBlock([
            additionalVariableStatement,
            returnSt
        ], true)
    );
};
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
export const getMemoCallbackHookDeclarationText = (
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

    if (type?.isUnion() && hookName === 'useCallback') {
        const types = type.types.filter(_type => !!_type.getCallSignatures().length);

        typeNode = ts.factory.createUnionTypeNode(types.map(t => tsChecker.typeToTypeNode(t, undefined, undefined)).filter(t => !!t));
    } else {
        typeNode = type ? tsChecker.typeToTypeNode(type, undefined, undefined) : undefined;
    }

    const identifier = ts.factory.createIdentifier(hookName);

    let firstExpress: ts.Expression;


    if (hookName === 'useMemo') {
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
export const getRefHookDeclarationText = (
    variableName: string,
    type: ts.Type | undefined | null,
    printer: ts.Printer,
    sourceFile: ts.SourceFile | undefined,
    tsChecker: ts.TypeChecker
) => {
    const identifier = ts.factory.createIdentifier('useRef');
    const typeNode = type ? tsChecker.typeToTypeNode(type, undefined, undefined) : undefined;

    const valueNode = ts.factory.createNull();

    const hookExpression = ts.factory.createCallExpression(
        identifier,
        typeNode ? [typeNode] : typeNode,
        [
            valueNode,
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
export const generateVariableName = (
    sourceNode: TSESTree.Node,
    tsService: TsService,
    componentName: string,
    propName: string,
    capitalLower?: boolean,
    beforeCheckDuplicate?: (name: string) => string
): string => {
    // Convert property name to PascalCase

    let propNamePascal = propName
        .split(/[-_]/)
        .map((part, index) => part.charAt(0)['toUpperCase']() + part.slice(1))
        .join('');

    // Ensure first letter is uppercase
    propNamePascal = propNamePascal.charAt(0).toUpperCase() + propNamePascal.slice(1);

    if (capitalLower) {
        componentName = componentName[0].toLowerCase() + componentName.slice(1);
    }

    // Combine to create ComponentNamePropName format
    let baseName = `${componentName}${propNamePascal}`;

    const scopedVariables = tsService.program.getTypeChecker().getSymbolsInScope(
        tsService.esTreeNodeToTSNodeMap.get(sourceNode),
        SymbolFlags.BlockScopedVariable
    ).map(s => s.name);

    // Check for name conflicts, add numeric suffix if needed
    let finalName = beforeCheckDuplicate?.(baseName) ?? baseName;
    let count = 1;

    while (scopedVariables.includes(finalName)) {
        finalName = `${finalName}${count}`;
        count++;
    }

    return finalName;
}; // 在每行添加额外的空格（通过操作原始代码）
export const addIndentationToEachLine = (code: string, spacesToAdd: number = 2, ignoreBeginning = true): string => {
    const spaces = ' '.repeat(spacesToAdd);
    const strings = code.split('\n');

    return strings.map((line, index) => (index === 0 && ignoreBeginning ? '' : spaces) + line).join('\n');
};