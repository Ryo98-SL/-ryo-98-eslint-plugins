/**
 * @fileoverview ESLint plugin to prevent inline object literals in React props with TypeScript compiler API integration
 */
"use strict";
import {
    addIndentationToEachLine,
    analyzeTypeAndCreateImports, createImport,
    findEndInsertPosition,
    findParentNode,
    findReferenceUsagesInScope,
    findStartInsertPosition,
    generateVariableName,
    getComponentName,
    getComponentNameFromClassName,
    getTypeForProp,
    type ImportUpdateResult, mergeImportUpdateResults,
    type PluginOptions,
    processIgnoredComponentsConfig,
    shouldIgnoreComponent
} from "./utils.ts";

import * as EsCodeGen from 'escodegen';
import {AST_NODE_TYPES, ESLintUtils} from '@typescript-eslint/utils';
import {parse as tsAstParse} from "@typescript-eslint/typescript-estree";
import ts, {SyntaxKind} from "typescript";
import type {FlatConfig, RuleFix, RuleFixer} from "@typescript-eslint/utils/ts-eslint";
import path from "path";

const createRule = ESLintUtils.RuleCreator(
    name => `https://example.com/rule/${name}`,
);


const rule = createRule({
    name: 'react-no-inline-literal-object',
    meta: {
        type: "suggestion",
        docs: {
            description: "Prevent inline object literals in React JSX props and add proper type definitions",
        },
        fixable: "code",
        messages: {
            'noInline': 'ShuDeliang: 避免使用内联{{type}}{{propName}},以防止冗余的re-render',
            'fixWithUseMemo': 'ShuDeliang: 使用const {{name}} = useMemo(...)包裹',
            'fixWithTopLevelScopeConstant': 'ShuDeliang: 创建顶层的{{name}}变量'
        },
        hasSuggestions: true,
        schema: [
            {
                type: "object",
                properties: {
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
                    }
                },
                additionalProperties: false
            }
        ],
    },
    defaultOptions: [{}],
    create(context) {
        // Get options
        const options: PluginOptions = context.options[0] || {};
        const shouldAddTypes = options.typeDefinitions !== false;
        const shortComponentNameThreshold = options.shortComponentNameThreshold || 5;
        const ignoredComponentsConfig = options.ignoredComponents || [];
        const declarationsPosition = options.declarationsPosition || "end";


        // Process ignored components config
        const { ignoredComponentsExact, ignoredComponentsRegex } = processIgnoredComponentsConfig(ignoredComponentsConfig);
        // Store for created constants
        const createdConstants = new Map<string, string>();
        // Track added constant declarations
        const addedConstantDeclarations = new Set<string>();
        // Track constants to add at file end
        const constantDeclarationsToAdd: string[] = [];

        const filename = context.filename;

        // TypeScript service for type analysis
        const tsService = ESLintUtils.getParserServices(context);
        const tsChecker = tsService.program.getTypeChecker();
        const sourceFile = tsService.program.getSourceFile(context.filename);

        const printer = ts.createPrinter();

        return {
            // Detect object literals in JSX attributes
            JSXAttribute(node) {
                if(!node.value) return;
                if(node.value.type !== AST_NODE_TYPES.JSXExpressionContainer) return;

                if (
                    node.value.expression.type !== "ObjectExpression"
                ) {
                    return;
                }

                const propName = node.name.name as string;
                const objectExpression = node.value.expression;
                const jsxElement = node.parent;
                let componentName = getComponentName(jsxElement);
                if (shouldIgnoreComponent(componentName, ignoredComponentsExact, ignoredComponentsRegex)) {
                    return;
                }
                const functionComponentNode = findParentNode(objectExpression, [AST_NODE_TYPES.FunctionDeclaration, AST_NODE_TYPES.ArrowFunctionExpression]);
                if (!functionComponentNode) {
                    // not in FC, unnecessary apply rule.
                    return;
                }
                const references = findReferenceUsagesInScope(tsService, objectExpression);
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
                let scene = 'top-level-constant';
                if (componentScopedReferences.length) {
                    console.log(`=>(index.ts:139) ${componentName} ${node.name.name} attribute 存在组件状态的引用:`, componentScopedReferences.map(r => r.name));
                    scene = 'hook';
                } else {
                    console.log(`=>(index.ts:164) ${componentName}'s ${propName} is no externalReferences`,);
                }
                if (componentName.length < shortComponentNameThreshold) {
                    const classNameComponent = getComponentNameFromClassName(jsxElement);
                    if (classNameComponent) {
                        componentName = classNameComponent;
                    }
                }
                const objectText = EsCodeGen.generate(objectExpression, {parse: tsAstParse});
                const variableName = generateVariableName(componentName, propName, createdConstants);
                const typeAnnotation = getTypeForProp(
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
                    pushImport(analyzeTypeAndCreateImports(typeAnnotation, tsChecker, sourceFile, tsService.program))
                }


                console.log("=>(index.ts:203) importUpdateResults", importUpdateResults.length);
                const typeString = `${!typeAnnotation ? "any" : tsChecker.typeToString(typeAnnotation)}`;
                const needToAddDeclaration = !createdConstants.has(objectText);
                if (needToAddDeclaration) {
                    createdConstants.set(objectText, variableName);
                } else {
                    // If constant already exists, use existing name
                    const existingName = createdConstants.get(objectText)!;
                    createdConstants.set(objectText, existingName);
                }
                const usedVariableName = createdConstants.get(objectText)!;
                const programNode = context.sourceCode.ast;
                const suggestList: MutableArray<Parameters<typeof context.report>[0]['suggest'] & {}> = [];
                let fixFn: Parameters<typeof context.report>[0]['fix'];
                const injectWithImport = (fixer: RuleFixer, fixes: RuleFix[]) => {
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
                            }
                        }

                    })
                }
                if (scene === 'hook') {
                    fixFn = (fixer) => {
                        const fixes: RuleFix[] = [];

                        if(sourceFile) {
                            pushImport(createImport('useMemo', 'react', false, sourceFile, tsService.program ));
                        }
                        injectWithImport(fixer, fixes);

                        fixes.push(fixer.replaceText(objectExpression, usedVariableName));

                        if (needToAddDeclaration && !addedConstantDeclarations.has(usedVariableName)) {

                            const {end: insertPosition, indent} = componentScopedReferences.reduce((info, symbol) => {
                                const _pos = (symbol.valueDeclaration!).end;
                                const parent = findParentNode(tsService.tsNodeToESTreeNodeMap.get(symbol.valueDeclaration!), [AST_NODE_TYPES.FunctionDeclaration, AST_NODE_TYPES.VariableDeclaration, AST_NODE_TYPES.ClassDeclaration]);


                                if (info.end < _pos) {
                                    return {end: (parent?.range[1] ?? 0) + 1, indent: parent?.loc.start.column ?? 0}
                                }

                                return info;
                            }, {end: 0, indent: 0});

                            const depsText = componentScopedReferences.map(r => r.name).join(',');

                            const useMemoStatementText = `\nconst ${usedVariableName} = useMemo<${typeString}>(() => {\n` +
                                `  return ${objectText};\n},[${depsText}]);\n`;

                            fixes.push(fixer.insertTextAfterRange([insertPosition, insertPosition],
                                addIndentationToEachLine(useMemoStatementText, indent)
                            ))
                        }

                        return fixes;
                    }

                    suggestList.push({
                        messageId: 'fixWithUseMemo',
                        data: {name: usedVariableName},
                        fix: fixFn
                    })
                } else {
                    fixFn = (fixer) => {
                        const fixes: RuleFix[] = [];

                        injectWithImport(fixer, fixes);


                        // Replace object literal with variable name
                        fixes.push(fixer.replaceText(objectExpression, usedVariableName));

                        // If new constant declaration is needed, add fix
                        if (needToAddDeclaration && !addedConstantDeclarations.has(usedVariableName)) {
                            // Determine insert position
                            const insertPosition = declarationsPosition === "start"
                                ? findStartInsertPosition(programNode)
                                : findEndInsertPosition(programNode);


                            const constDeclaration = `\nconst ${variableName} : ${typeString} = ${objectText};\n`;

                            if (declarationsPosition === "start") {
                                const insertAfterNode = context.sourceCode.getNodeByRangeIndex(insertPosition);
                                if (insertAfterNode) {
                                    fixes.push(fixer.insertTextAfter(insertAfterNode, constDeclaration));
                                }
                            } else {
                                // Insert at file end
                                const lastToken = context.sourceCode.getLastToken(programNode);
                                if (lastToken) {
                                    fixes.push(fixer.insertTextAfter(lastToken, constDeclaration));
                                }
                            }

                            // Mark this variable declaration as added
                            addedConstantDeclarations.add(usedVariableName);
                        }

                        return fixes;

                    }

                    suggestList.push({
                            messageId: 'fixWithTopLevelScopeConstant',
                            data: {name: usedVariableName},
                            fix: fixFn
                        }
                    )
                }
                context.report({
                    node,
                    messageId: `noInline`,
                    data: {
                        type: '字面量对象',
                        propName
                    },
                    suggest: suggestList,
                    fix: fixFn
                });
            },

        };
    }
});

type RuleMessageIds = typeof rule extends ESLintUtils.RuleModule<infer R,[{}], unknown, ESLintUtils.RuleListener> ? R : never;

type MutableArray<T extends readonly any[]> = T extends readonly (infer R)[] ? R[] : T;

export default {
    rules: {
        "no-inline-object-literals": rule
    }
} satisfies FlatConfig.Plugin;