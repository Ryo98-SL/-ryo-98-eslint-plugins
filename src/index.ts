/**
 * @fileoverview ESLint plugin to prevent inline object literals in React props with TypeScript compiler API integration
 */
import {FlatConfig} from "@typescript-eslint/utils/ts-eslint";
import {wrapMemoHook} from "./rules/wrap-hooks/rule.ts";
import {autoCreateRefRule} from "./rules/auto-create-ref/rule.ts";
import fs from "fs";
import * as parser from '@typescript-eslint/parser';

const pkg: { name: string, version: string } = JSON.parse(
    fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const allRules: FlatConfig.Plugin['rules'] = {
    "wrap-memo-hook": wrapMemoHook,
    "auto-create-ref": autoCreateRefRule,
}




const configs:{ recommended: FlatConfig.SharedConfigs } = {
    // @ts-ignore
    recommended: undefined
};

Object.setPrototypeOf(configs, null);


const plugin = {
    rules: allRules,
    configs,
    meta: {
        name: pkg.name,
        version: pkg.version,
    }
} satisfies FlatConfig.Plugin;

Object.assign(configs, {
    recommended: {
        plugins: {
            "react-codemod": plugin
        },
        rules: {
            "react-codemod/wrap-memo-hook": ["warn", { ignoredComponents: ["^[a-z]"] }],
            "react-codemod/auto-create-ref": ["warn"],
        },
        files: ["**/*.tsx","!**/*.test.tsx"],
        languageOptions: {
            parser: parser,
            parserOptions: {
                lib: ['dom'],
                projectService: {
                    allowDefaultProject: ['*.ts*'],
                },
                tsconfigRootDir: import.meta.dirname,
                ecmaFeatures: {
                    jsx: true,
                },
            },
        }

    }
} satisfies FlatConfig.Plugin['configs']);


export default plugin;



