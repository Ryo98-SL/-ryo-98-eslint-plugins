import {describe, test, expect, beforeAll} from "vitest";
import url from "url";
import path from "path";
import {resolveTestPaths} from "../../../utils/extractPathInfoReg.ts";
import {ROOT_PATH} from "../../../../paths";
import eslint from "eslint";
import tslint from "typescript-eslint";
import * as parser from "@typescript-eslint/parser";
import {wrapMemoHook} from "../rule.ts";

import fs from "fs";

const TestFilePath = path.resolve(url.fileURLToPath(import.meta.url),'../');
const IncludeTestNames: string[] = [  ];

const tsconfigRootDir = ROOT_PATH;

const infoList = (await resolveTestPaths(TestFilePath)).filter(
    info => IncludeTestNames.length ? IncludeTestNames.includes(info.name) : true
);



beforeAll(async () => {

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
                    'codemod': {
                        rules: {
                            "wrap-memo-hook": wrapMemoHook
                        }
                    }
                },
                rules: {
                    'codemod/wrap-memo-hook': ['warn'],
                }

            })});


    for (const info of infoList) {
        const { resolve, promise } = Promise.withResolvers();

        const rd = fs.createReadStream(info.paths.in, { encoding: "utf-8" });

        const wt = fs.createWriteStream(info.paths.out, { encoding: "utf-8" });

        rd.pipe(wt);
        wt.addListener('finish', () => {
            resolve()
        });
        promise
            .then(() => linter.lintFiles([info.paths.out]))
            .then(result => {
                return eslint.ESLint.outputFixes(result);
            })
    }
})

describe("test wrap-memo-hook", async () => {

    for (const info of infoList) {
        test(`wrap-memo-hook ${info.name}`,  () => {
            const fileContent = fs.readFileSync(info.paths.out).toString('utf8');
            expect(
                fileContent
            ).toMatchSnapshot()
        });

    }

});



