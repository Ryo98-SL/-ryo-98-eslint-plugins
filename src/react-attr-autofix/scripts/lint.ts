import eslint from "eslint";
import tslint from "typescript-eslint";
import eslintjs from "@eslint/js";
import ReactNoInlineLiterals from "../index.ts";
import {fileURLToPath} from "node:url";
import path from "path";
import * as parser from '@typescript-eslint/parser';
import fs from "fs";
import {ROOT_PATH} from "../../paths";
import {getTestData} from "../../utils";

const tsconfigRootDir = ROOT_PATH;

const linter = new eslint.ESLint({
    fix: true,
    fixTypes: ['suggestion'],
    overrideConfigFile: true,
    // @ts-ignore
    overrideConfig: tslint.config(
        {
            languageOptions: {
                parser: parser,
                parserOptions: {
                    lib: ['dom'],
                    projectService: {
                        allowDefaultProject: ['*.ts*'],
                    },
                    ecmaFeatures: {
                        jsx: true,
                    },
                    tsconfigRootDir: tsconfigRootDir,
                },
            },
            files: ['**/*.tsx'],
            plugins: {
                'react-attr-autofix': ReactNoInlineLiterals
            },
            rules: {
                'react-attr-autofix/no-inline-literal-object': ['warn', ReactNoInlineLiterals.rules["no-inline-literal-object"].defaultOptions[0]],
                'react-attr-autofix/auto-create-ref': ['warn']
            }

        })});

const {content: testFileContents, fixPath} = getTestData(3)

fs.writeFileSync(fixPath, testFileContents[0]);

linter.lintFiles([fixPath])
    .then(result => {
        return eslint.ESLint.outputFixes(result);
    })
    .catch(eslintError => {
        console.error(eslintError);
    })
