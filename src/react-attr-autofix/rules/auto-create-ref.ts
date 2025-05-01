import {
    addIndentationToEachLine,
    analyzeTypeAndCreateImports,
    createRule, getComponentName, getRefHookDeclarationText,
    getTypeNodeForProp
} from "../../utils";
import {AST_NODE_TYPES, ESLintUtils} from "@typescript-eslint/utils";
import {RuleFix} from "@typescript-eslint/utils/ts-eslint";
import ts, {EmitHint, TypeFlags} from "typescript";
import path from "path";
import {TSESTree} from "@typescript-eslint/typescript-estree";
import {ImportUpdateResult} from "../../utils/types.ts";
import {getPositionBetweenReturnAndSymbols, transformFunctionWithNonBlockStatement} from "../../utils";
import {findParentNode, findScopedVariable} from "../../utils";
import {createImport, injectWithImport, mergeImportUpdateResults} from "../../utils";


export const autoCreateRefRule = createRule({
    name: "auto-inline-ref",
    meta: {
        type: "suggestion",
        docs: {
            description: "auto create useRef hook for a ref prop",

        },
        fixable: "code",
        schema: [],
        messages: {
            'fast-create': 'Shudeliang: create a useRef with name: {{name}}'
        }
    },
    defaultOptions: [{}],
    create(context) {
        const tsService = ESLintUtils.getParserServices(context);
        const tsChecker = tsService.program.getTypeChecker();
        const sourceFile = tsService.program.getSourceFile(context.filename);
        const sourceCode = context.sourceCode;
        const filename = context.filename;
        const scopeManager = context.sourceCode.scopeManager!
        const printer = ts.createPrinter();

        return {
            "JSXAttribute": (node) => {
                if (!node.value || node.name.name !== 'ref') return;
                if (node.value.type !== AST_NODE_TYPES.JSXExpressionContainer) return;
                const expression = node.value.expression;
                if(expression.type !== AST_NODE_TYPES.Identifier) return;

                const functionComponentNode = findParentNode(expression.parent, [AST_NODE_TYPES.FunctionExpression, AST_NODE_TYPES.FunctionDeclaration, AST_NODE_TYPES.ArrowFunctionExpression]);
                if (!functionComponentNode) {
                    // not in FC, unnecessary apply the rule.
                    return;
                }

                const refScope = sourceCode.getScope(expression);
                const found = findScopedVariable(expression.name, refScope);

                if (found) {
                    return;
                }

                const jsxElement = node.parent;
                let componentName = getComponentName(jsxElement);

                const resolvedCompPropTypeInfo = getTypeNodeForProp(
                    node,
                    'ref',
                    componentName,
                    true,
                    true,
                    tsService,
                    filename,
                    context
                );



                if(!resolvedCompPropTypeInfo) return;

                // get type argument "T" specified type of Ref<T>
                //@ts-ignore
                const [typeArgument] = (resolvedCompPropTypeInfo.type.origin as ts.UnionType).types.filter(t => !(t.flags & TypeFlags.Undefined) && !(t.flags & TypeFlags.Null));

                if (!typeArgument) {
                    return;
                }

                let importUpdateResults: ImportUpdateResult[] = [];

                const pushImport = (update: ImportUpdateResult | ImportUpdateResult[]) => {
                    if (sourceFile) {
                        importUpdateResults = mergeImportUpdateResults(importUpdateResults.concat(update), path.dirname(filename));
                    }
                }

                const aliasTypeArgument = typeArgument.aliasTypeArguments?.[0];
                if (!aliasTypeArgument) {
                    return;
                }

                pushImport(createImport('useRef', 'react', false, sourceFile!, tsService.program));
                pushImport(analyzeTypeAndCreateImports(aliasTypeArgument, tsService, tsChecker, sourceFile!, tsService.program, scopeManager, {resolveToRelativePath: true}))

                const {text: declarationText, variableStatement} = getRefHookDeclarationText(expression.name, aliasTypeArgument, printer, sourceFile, tsChecker);

                context.report({
                    node,
                    messageId: 'fast-create',
                    data: {name: expression.name},
                    fix: (fixer) => {
                        const fixes: RuleFix[] = [];
                        injectWithImport(fixer, fixes, tsService, printer, importUpdateResults, sourceFile);


                        if (functionComponentNode.body.type === AST_NODE_TYPES.BlockStatement) {

                            const {
                                insertPosition,
                                indent
                            } = getPositionBetweenReturnAndSymbols(
                                functionComponentNode.body,
                                [],
                                tsService
                            )

                            fixes.push(fixer.insertTextAfterRange([insertPosition, insertPosition],
                                addIndentationToEachLine(declarationText, indent)
                            ));

                        } else {
                            const arrowFunction = transformFunctionWithNonBlockStatement(
                                functionComponentNode as TSESTree.ArrowFunctionExpression,
                                tsService,
                                variableStatement,
                            )

                            fixes.push(
                                fixer.replaceText(functionComponentNode, printer.printNode(EmitHint.Expression, arrowFunction, sourceFile!))
                            )
                        }


                        return fixes
                    }
                });

            }
        }
    }
})