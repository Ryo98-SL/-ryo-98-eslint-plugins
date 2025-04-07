import eslint from "eslint";
import tslint from "typescript-eslint";
import eslintjs from "@eslint/js";
import ReactNoInlineLiterals from "../index.ts";
import {getTestData} from "../../utils.ts";
import {fileURLToPath} from "node:url";
import path from "path";
import * as parser from '@typescript-eslint/parser';
import fs from "fs";
import {ROOT_PATH} from "../../paths";

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
                'react-pref-autofix': ReactNoInlineLiterals
            },
            rules: {
                'react-pref-autofix/no-inline-literal-object': ['warn', ReactNoInlineLiterals.rules["no-inline-literal-object"].defaultOptions[0]],
                'react-pref-autofix/auto-create-ref': ['warn']
            }

        })});

const {content: testFileContents, fixPath} = getTestData(1)

fs.writeFileSync(fixPath, testFileContents[0]);

linter.lintFiles([fixPath])
    .then(result => {
        return eslint.ESLint.outputFixes(result);
    })
    .catch(eslintError => {
        console.error(eslintError);
    })
