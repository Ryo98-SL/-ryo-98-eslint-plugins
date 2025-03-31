import eslint from "eslint";
import tslint from "typescript-eslint";
import eslintjs from "@eslint/js";
import NoInlineLiteralObject from "./index.ts";
import {getTestData} from "./utils.ts";
import {fileURLToPath} from "node:url";
import path from "path";
import * as parser from '@typescript-eslint/parser';
import fs from "fs";

const tsconfigRootDir = path.resolve(fileURLToPath(import.meta.url), '../../../');
const tsconfigPath = path.resolve(tsconfigRootDir, 'tsconfig.json');

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
                'react-no-inline-literal-object': NoInlineLiteralObject
            },
            rules: {
                'react-no-inline-literal-object/no-inline-object-literals': 'warn'
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
