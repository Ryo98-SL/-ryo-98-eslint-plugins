import ts, {factory} from "typescript";
import * as util from "node:util";
import {ResolvedCompPropTypeInfo, TsService} from "./types.ts";
import {getReactSourceFile} from "./resolve-module-path.ts";

export const resolveContainingType = (targetType: ts.Type, potentialContainerType: ts.Type, tsChecker: ts.TypeChecker): ts.Type[] => {

    let trace: ts.Type[] = [];

    const visit = (_targetType: ts.Type, _fromType: ts.Type): boolean => {
        let found = false;

        if(_fromType.isIntersection() || _fromType.isUnion()) {

            for (const t of _fromType.types) {
                if (t.symbol === _targetType.symbol || t.symbol === _targetType.aliasSymbol) {
                    found = true;
                    break;
                }

                visit(_targetType, t);
            }

        } else if(_fromType.isClassOrInterface() || (_fromType.flags & ts.TypeFlags.Object)){
            // console.log(`${tsChecker.typeToString(targetType)}`,{
            //     'hasSymbol': !!potentialContainerType.aliasSymbol,
            //     'potentialContainerType.isClassOrInterface()': potentialContainerType.isClassOrInterface(),
            //     'ts.TypeFlags.Object': (potentialContainerType.flags & ts.TypeFlags.Object) !== 0,
            //     'isLiteral': potentialContainerType.isLiteral(),
            // });


            for (const p of _fromType.getProperties()) {
                const vd = p.valueDeclaration && tsChecker.getTypeAtLocation(p.valueDeclaration);
                const isSame = vd === _targetType;
                console.log(`property ${p.name}`, {isSame, ts: tsChecker.typeToString(_targetType), vds: vd && tsChecker.typeToString(vd)});

                if(isSame || (vd && visit(_targetType, vd))) {
                    found = true;
                    break;
                }
            }

        } else {
            console.log(`fromType ${tsChecker.typeToString(_fromType)} not handle`, {flags: _fromType.flags}, util.inspect(_fromType, {depth: 0}))
        }

        if(found) {
            trace.unshift(_fromType);
        }

        return found;
    }


    visit(targetType, potentialContainerType);


    return trace;
}



export function getExtractType(componentName: string, propName: string, attrType: ts.Type | ts.TypeNode | undefined, hookName: string, resolvedTypeInfo: ResolvedCompPropTypeInfo, tsService: TsService, tsChecker: ts.TypeChecker) {
    const cnId = factory.createIdentifier(componentName);
    const typeQuery = factory.createTypeQueryNode(cnId,);
    const parametersTypeRef = factory.createTypeReferenceNode('Parameters', [typeQuery]);
    const indexLiteral = factory.createNumericLiteral(0);
    const zeroLiteral = factory.createLiteralTypeNode(indexLiteral);

    const propsAccessTypeNode = factory.createIndexedAccessTypeNode(parametersTypeRef, zeroLiteral);
    const propStringLiteral = factory.createStringLiteral(propName);
    const propLiteral = factory.createLiteralTypeNode(propStringLiteral);
    const indexedAccessTypeNode = factory.createIndexedAccessTypeNode(propsAccessTypeNode, propLiteral);

    attrType = indexedAccessTypeNode;

    if (hookName === 'useCallback' && resolvedTypeInfo && resolvedTypeInfo.type.flags) {
        const reactSourceFile = getReactSourceFile(tsService.program);

        const findUseCallback = (from: ts.Node): (undefined | ts.FunctionDeclaration) => {
            return ts.forEachChild(from, (c) => {
                if (ts.isFunctionDeclaration(c) && c.name?.text === 'useCallback') {
                    return c;
                }

                if (c.getChildren().length) {
                    return findUseCallback(c);
                }

                return undefined;
            });

        }


        if (reactSourceFile) {
            const useCallbackNode = findUseCallback(reactSourceFile);
            if (useCallbackNode) {
                const firstParameterType = tsChecker.getTypeAtLocation(useCallbackNode.parameters[0]);
                const typeParameter = firstParameterType.symbol.declarations?.[0] as unknown as ts.TypeParameter;

                //@ts-ignore
                const constraint: ts.Typenode = typeParameter.constraint;

                const isAssignableToUseCallback = tsChecker.isTypeAssignableTo(resolvedTypeInfo.type, tsChecker.getTypeAtLocation(constraint));
                if (!isAssignableToUseCallback) {
                    const parenthesized = factory.createParenthesizedType(indexedAccessTypeNode)

                    const functionRef = factory.createTypeReferenceNode('Function');
                    const intersectionTypeNode = factory.createIntersectionTypeNode([parenthesized, functionRef]);

                    attrType = intersectionTypeNode;
                }
            }
        }
    }
    return attrType;
}