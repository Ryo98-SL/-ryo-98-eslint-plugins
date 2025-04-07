/**
 * @fileoverview ESLint plugin to prevent inline object literals in React props with TypeScript compiler API integration
 */
"use strict";
import type {FlatConfig} from "@typescript-eslint/utils/ts-eslint";
import {noInlineLiteralObjectRule} from "./rules/no-inline-literal-object.ts";
import {autoCreateRefRule} from "./rules/auto-create-ref.ts";


export default {
    rules: {
        "no-inline-literal-object": noInlineLiteralObjectRule,
        "auto-create-ref": autoCreateRefRule,
    }
} satisfies FlatConfig.Plugin;



