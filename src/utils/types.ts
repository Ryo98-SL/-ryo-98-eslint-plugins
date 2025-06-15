import {AST_NODE_TYPES, ParserServicesWithTypeInformation, TSESTree} from "@typescript-eslint/typescript-estree";
import type {RuleContext} from "@typescript-eslint/utils/ts-eslint";
import ts from "typescript";

/**
 * 从类型中获取模块信息
 * 此函数需要根据您的实际实现提供
 */
export interface ModuleInfo {
    moduleName: string;
    isDefaultExport?: boolean;
}

export interface RegExpConfig {
    pattern: string;
    flags?: string;
}

export type TsService = ParserServicesWithTypeInformation;
export type TypedRuleContext =  Readonly<RuleContext<"noInline" | "fixWithUseHook" | "fixWithTopLevelScopeConstant", [{
    ignoredComponents: {
        pattern: string
    }[]
}]>>;

type MapNodeUtil<N extends TSESTree.Node, T extends AST_NODE_TYPES> = N extends { type: T } ? N : never;
type MapNodeWithType<T extends AST_NODE_TYPES> = {
    [K in T]: MapNodeUtil<TSESTree.Node, K>
}[T];
export type MapNodeWithTypes<T extends AST_NODE_TYPES | (readonly AST_NODE_TYPES[])> = T extends AST_NODE_TYPES ?
    MapNodeWithType<T>
    : T extends readonly AST_NODE_TYPES[] ? MapNodeWithType<T[number]> : never;
type DeclarationNodeType = TSESTree.VariableDeclarator | TSESTree.FunctionDeclaration | TSESTree.ClassDeclaration

/**
 * 导入声明更新结果接口，包含原始声明和新的声明
 */
export interface ImportUpdateResult {
    /** 原始的导入声明，如果是新创建的则为null */
    originalDeclaration: ts.ImportDeclaration | null;
    /** 更新后或新创建的导入声明 */
    newDeclaration: ts.ImportDeclaration;
}

/**
 * 表示导入更新的结果
 */
export interface ImportUpdateResult {
    originalDeclaration: ts.ImportDeclaration | null;
    newDeclaration: ts.ImportDeclaration;
}

export type FixScene = 'top-level-constant' | 'hook';
export type MutableArray<T extends readonly any[]> = T extends readonly (infer R)[] ? R[] : T;
export type ResolvedCompPropTypeInfo = { type: ts.Type, propsType: ts.Type };