/**
 * @fileoverview ESLint plugin to prevent inline object literals in React props with TypeScript compiler API integration
 */
"use strict";
import {
    addIndentationToEachLine,
    analyzeTypeAndCreateImports,
    createImport,
    findEndInsertPosition,
    findParentNode,
    findReferenceUsagesInScope,
    findStartInsertPosition,
    FixScene,
    generateVariableName,
    getComponentName,
    getComponentNameFromClassName,
    getConstDeclarationText,
    getHookDeclarationText,
    getTypeNodeForProp,
    type ImportUpdateResult,
    injectWithImport,
    isNodeDescendantWithKind,
    mergeImportUpdateResults,
    type PluginOptions,
    processIgnoredComponentsConfig, RefPattern, SetStateTypeStringPattern,
    shouldIgnoreComponent
} from "./utils.ts";

import {AST_NODE_TYPES, ESLintUtils} from '@typescript-eslint/utils';
import ts, {EmitHint, SyntaxKind, TypeFlags} from "typescript";
import type {FlatConfig, RuleFix} from "@typescript-eslint/utils/ts-eslint";
import path from "path";

const createRule = ESLintUtils.RuleCreator(
    name => `https://example.com/rule/${name}`,
);



const noInlineLiteralObjectRule = createRule({
    name: 'no-inline-literal-object',
    meta: {
        type: "suggestion",
        docs: {
            description: "Prevent inline object literals in React JSX props and add proper type definitions",
        },
        fixable: "code",
        messages: {
            'noInline': 'ShuDeliang: 避免使用内联{{type}}{{propName}},以防止冗余的re-render',
            'fixWithUseHook': 'ShuDeliang: 使用const {{name}} = {{hookName}}(...)包裹',
            'fixWithTopLevelScopeConstant': 'ShuDeliang: 创建顶层的{{name}}变量'
        },
        hasSuggestions: true,
        schema: [
            {
                type: "object",
                properties: {
                    checkFunction: {
                        type: "boolean",
                        default: true,
                    },
                    checkArray: {
                        type: "boolean",
                        default: true,
                    },
                    checkReturnValueOfCalling: {
                        type: "boolean",
                        default: true,
                    },
                    checkNewExpression: {
                        type: "boolean",
                        default: true,
                    },
                    checkRegExp: {
                        type: "boolean",
                        default: true,
                    },
                    typeDefinitions: {
                        type: "boolean",
                        default: true
                    },
                    shortComponentNameThreshold: {
                        type: "number",
                        default: 5
                    },
                    ignoredComponents: {
                        type: "array",
                        items: {
                            oneOf: [
                                {
                                    type: "string"
                                },
                                {
                                    type: "object",
                                    properties: {
                                        pattern: { type: "string" },
                                        flags: { type: "string" }
                                    },
                                    required: ["pattern"],
                                    additionalProperties: false
                                }
                            ]
                        },
                        default: []
                    },
                    declarationsPosition: {
                        type: "string",
                        enum: ["start", "end"],
                        default: "end"
                    },

                },
                additionalProperties: false
            }
        ],
    },
    defaultOptions: [{ignoredComponents: [{ pattern: '^[a-z]' }]}],
    create(context) {
        // Get options
        const options: PluginOptions = context.options[0] || {};
        const shouldAddTypes = options.typeDefinitions !== false;
        const shortComponentNameThreshold = options.shortComponentNameThreshold || 5;
        const ignoredComponentsConfig = options.ignoredComponents || [];
        const declarationsPosition = options.declarationsPosition || "end";

        // Process ignored components config
        const { ignoredComponentsExact, ignoredComponentsRegex } = processIgnoredComponentsConfig(ignoredComponentsConfig);
        const filename = context.filename;

        // TypeScript service for type analysis

        const tsService = ESLintUtils.getParserServices(context);
        const tsChecker = tsService.program.getTypeChecker();
        const sourceFile = tsService.program.getSourceFile(context.filename);
        const scopeManager = context.sourceCode.scopeManager!
        const printer = ts.createPrinter();
        return {
            // Detect object literals in JSX attributes
            JSXAttribute(node) {
                if(!node.value) return;
                if(node.value.type !== AST_NODE_TYPES.JSXExpressionContainer) return;

                const expressionType = node.value.expression.type;

                if (
                    (expressionType !== AST_NODE_TYPES.ObjectExpression) &&
                    (expressionType !== AST_NODE_TYPES.CallExpression || !options.checkReturnValueOfCalling) &&
                    (expressionType !== AST_NODE_TYPES.NewExpression || !options.checkNewExpression) &&
                    (expressionType !== AST_NODE_TYPES.Literal ||  !('regex' in node.value.expression) || !options.checkRegExp) &&
                    (expressionType !== AST_NODE_TYPES.MemberExpression || !('object' in node.value.expression) || node.value.expression.object.type !== AST_NODE_TYPES.ObjectExpression) &&
                    (expressionType !== AST_NODE_TYPES.MemberExpression || !('object' in node.value.expression) || node.value.expression.object.type !== AST_NODE_TYPES.NewExpression || !options.checkNewExpression) &&
                    (expressionType !== AST_NODE_TYPES.MemberExpression || !('object' in node.value.expression) || node.value.expression.object.type !== AST_NODE_TYPES.ArrowFunctionExpression || !options.checkFunction) &&
                    (expressionType !== AST_NODE_TYPES.MemberExpression || !('object' in node.value.expression) || node.value.expression.object.type !== AST_NODE_TYPES.FunctionExpression || !options.checkFunction) &&
                    (expressionType !== AST_NODE_TYPES.MemberExpression || !('object' in node.value.expression) || node.value.expression.object.type !== AST_NODE_TYPES.ArrayExpression || !options.checkArray) &&
                    (expressionType !== AST_NODE_TYPES.ArrayExpression || !options.checkArray) &&
                    (expressionType !== AST_NODE_TYPES.FunctionExpression && expressionType !== AST_NODE_TYPES.ArrowFunctionExpression || !options.checkFunction)
                ) {
                    return;
                }



                const jsxElement = node.parent;
                let componentName = getComponentName(jsxElement);
                if (shouldIgnoreComponent(componentName, ignoredComponentsExact, ignoredComponentsRegex)) {
                    return;
                }

                const hookName = (
                    expressionType === AST_NODE_TYPES.ObjectExpression
                    || expressionType === AST_NODE_TYPES.ArrayExpression
                    || expressionType === AST_NODE_TYPES.NewExpression
                    || expressionType === AST_NODE_TYPES.CallExpression
                    || expressionType === AST_NODE_TYPES.MemberExpression
                ) ? 'useMemo' : 'useCallback';

                const propName = node.name.name as string;


                const expression = node.value.expression;
                const tsExpression = tsService.esTreeNodeToTSNodeMap.get(expression) as ts.FunctionExpression | ts.ObjectLiteralExpression;


                const functionComponentNode = findParentNode(expression.parent, [AST_NODE_TYPES.FunctionExpression, AST_NODE_TYPES.FunctionDeclaration, AST_NODE_TYPES.ArrowFunctionExpression]);
                if (!functionComponentNode) {
                    // not in FC, unnecessary apply the rule.
                    return;
                }
                const references = findReferenceUsagesInScope(tsService, expression);
                const componentScopedReferences = Array.from(references.values()).filter(s => {
                    if (!s.valueDeclaration) return false;
                    const symbolNode = tsService.tsNodeToESTreeNodeMap.get(s.valueDeclaration!);

                    const callExpression = findParentNode(symbolNode, AST_NODE_TYPES.CallExpression);

                    if (callExpression && callExpression.callee.type === AST_NODE_TYPES.Identifier && ['useMemo', 'useCallback'].includes(callExpression.callee.name)) {
                        return false;
                    }

                    const foundFunctionNode = findParentNode(symbolNode, [AST_NODE_TYPES.FunctionDeclaration, AST_NODE_TYPES.ArrowFunctionExpression]);
                    return foundFunctionNode === functionComponentNode;
                })

                const scenes = new Set<FixScene>();
                if (componentScopedReferences.length) {
                    console.log(`=>(index.ts:139) ${componentName} ${node.name.name} attribute 存在组件状态的引用:`, componentScopedReferences.map(r => r.name));
                    scenes.add('hook');
                } else {
                    scenes.add('top-level-constant');

                    if( hookName === 'useCallback' ) {
                        scenes.add('hook');
                    }

                    console.log(`=>(index.ts:164) ${componentName}'s ${propName} is no externalReferences`,);
                }


                if (componentName.length < shortComponentNameThreshold) {
                    const classNameComponent = getComponentNameFromClassName(jsxElement);
                    if (classNameComponent) {
                        componentName = classNameComponent;
                    }
                }

                const typeAnnotation = getTypeNodeForProp(
                    node,
                    propName,
                    componentName,
                    true,
                    shouldAddTypes,
                    tsService,
                    filename,
                    context
                );




                let importUpdateResults: ImportUpdateResult[] = [];

                const pushImport = (update: ImportUpdateResult | ImportUpdateResult[] ) => {
                    if(sourceFile) {
                        importUpdateResults = mergeImportUpdateResults(importUpdateResults.concat(update), path.dirname(filename));
                    }
                }


                if (typeAnnotation && sourceFile) {
                    const importUpdates = analyzeTypeAndCreateImports(typeAnnotation, tsService, tsChecker, sourceFile, tsService.program, scopeManager);
                    pushImport(importUpdates)
                }


                console.log("=>(index.ts:203) importUpdateResults", importUpdateResults.length, '\n\n');
                const programNode = context.sourceCode.ast;
                const suggestList: MutableArray<Parameters<typeof context.report>[0]['suggest'] & {}> = [];
                type FixFn = Parameters<typeof context.report>[0]['fix'];



                if (scenes.has('hook')) {
                    const variableName = generateVariableName(expression, tsService, componentName, propName, true);

                    const fixFn: FixFn = (fixer) => {
                        const fixes: RuleFix[] = [];
                        if(sourceFile) {
                            pushImport(createImport(hookName, 'react', false, sourceFile, tsService.program ));
                        }

                        injectWithImport(fixer, fixes, tsService, printer, importUpdateResults, sourceFile);

                        fixes.push(fixer.replaceText(expression, variableName));


                        let defaultIndent = 0;
                        let end = 0;
                        const noConsistReferences = componentScopedReferences.filter(ref => {
                            const refType = tsChecker.getTypeOfSymbol(ref);
                            const isSetStateFunction = SetStateTypeStringPattern.test(tsChecker.typeToString(refType));
                            const isRefObject = RefPattern.test(tsChecker.typeToString(refType));


                            return !isSetStateFunction && !isRefObject
                        });

                        const {text: hookStatementText, variableStatement} = getHookDeclarationText(
                            hookName,
                            tsExpression,
                            variableName,
                            typeAnnotation,
                            noConsistReferences,
                            printer,
                            sourceFile,
                            tsChecker,
                        );

                        if (functionComponentNode.body.type === AST_NODE_TYPES.BlockStatement) {

                            const body = functionComponentNode.body;
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
                            } = componentScopedReferences.reduce((info, symbol) => {
                                const _pos = (symbol.valueDeclaration!).end;
                                const parent = findParentNode(tsService.tsNodeToESTreeNodeMap.get(symbol.valueDeclaration!), [AST_NODE_TYPES.FunctionDeclaration, AST_NODE_TYPES.VariableDeclaration, AST_NODE_TYPES.ClassDeclaration]);


                                if (info.end < _pos) {
                                    return {end: (parent?.range[1] ?? 0) + 1, indent: parent?.loc.start.column ?? 0}
                                }

                                return info;
                            }, {end, indent: defaultIndent});


                            fixes.push(fixer.insertTextAfterRange([insertPosition, insertPosition],
                                addIndentationToEachLine(hookStatementText, indent)
                            ));

                        } else {
                            const fnCompNode = tsService.esTreeNodeToTSNodeMap.get(functionComponentNode);
                            const bodyNode = tsService.esTreeNodeToTSNodeMap.get(functionComponentNode.body);

                            const returnSt = ts.factory.createReturnStatement(bodyNode as ts.JsxElement);


                            const constructedBodyNode =  ts.factory.createBlock([variableStatement, returnSt]);
                            const functionExpression = ts.factory.createFunctionExpression(
                                // @ts-ignore
                                fnCompNode.modifiers?.map(modifier => ts.factory.createModifier(modifier.kind)),
                                fnCompNode.asteriskToken,
                                // @ts-ignore
                                fnCompNode.name,
                                fnCompNode.typeParameters,
                                fnCompNode.parameters,
                                fnCompNode.type,
                                constructedBodyNode
                            )

                            fixes.push(
                                fixer.replaceText(functionComponentNode, printer.printNode(EmitHint.Expression, functionExpression, sourceFile!) )
                            )
                        }


                        return fixes;
                    };


                    suggestList.push({
                        messageId: 'fixWithUseHook',
                        data: {name: variableName, hookName},
                        fix: fixFn
                    })
                }

                if(scenes.has('top-level-constant')) {
                    const variableName = generateVariableName(expression, tsService, componentName, propName, false);

                    const fixFn:  FixFn = (fixer) => {
                        const fixes: RuleFix[] = [];

                        injectWithImport(fixer, fixes, tsService, printer, importUpdateResults, sourceFile);


                        // Replace object literal with variable name
                        fixes.push(fixer.replaceText(expression, variableName));

                        // Determine insert position
                        const insertPosition = declarationsPosition === "start"
                            ? findStartInsertPosition(programNode)
                            : findEndInsertPosition(programNode);

                        const {text: declarationText} = getConstDeclarationText(tsExpression, variableName, typeAnnotation, printer, sourceFile, tsChecker);

                        if (declarationsPosition === "start") {
                            const insertAfterNode = context.sourceCode.getNodeByRangeIndex(insertPosition);
                            if (insertAfterNode) {
                                fixes.push(fixer.insertTextAfter(insertAfterNode, declarationText));
                            }
                        } else {
                            // Insert at file end
                            const lastToken = context.sourceCode.getLastToken(programNode);
                            if (lastToken) {
                                fixes.push(fixer.insertTextAfter(lastToken, declarationText));
                            }
                        }


                        return fixes;

                    };

                    suggestList.push({
                            messageId: 'fixWithTopLevelScopeConstant',
                            data: {name: variableName},
                            fix: fixFn

                        }
                    );


                }

                context.report({
                    node,
                    messageId: `noInline`,
                    data: {
                        type: '字面量对象',
                        propName
                    },
                    suggest: suggestList,
                    fix: suggestList[0].fix
                });
            },

        };
    }
});

type RuleMessageIds = typeof noInlineLiteralObjectRule extends ESLintUtils.RuleModule<infer R,[{}], unknown, ESLintUtils.RuleListener> ? R : never;

type MutableArray<T extends readonly any[]> = T extends readonly (infer R)[] ? R[] : T;

export default {
    rules: {
        "no-inline-literal-object": noInlineLiteralObjectRule
    }
} satisfies FlatConfig.Plugin;



