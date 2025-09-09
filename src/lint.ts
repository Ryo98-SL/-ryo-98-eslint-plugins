import eslint from "eslint";
import tslint from "typescript-eslint";
import ReactNoInlineLiterals from "./index.ts";
import {fileURLToPath} from "node:url";
import path from "path";
import * as parser from '@typescript-eslint/parser';
import fs from "fs";
import {ROOT_PATH} from "../paths";
import {resolveTestExample} from "../test.ts";

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
                'react-codemod': ReactNoInlineLiterals
            },
            rules: {
                'react-codemod/wrap-memo-hook': ['warn'],
                'react-codemod/auto-create-ref': ['warn']
            }

        }
    )});

const {input, out} = resolveTestExample('wrap-hooks', 'custom-format');

fs.writeFileSync(out.path, input.content);

linter.lintFiles([out.path])
    .then(result => {
        return eslint.ESLint.outputFixes(result);
    })
    .catch(eslintError => {
        console.error(eslintError);
    })
