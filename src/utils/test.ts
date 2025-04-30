import path from "path";
import {fileURLToPath} from "node:url";
import fs from "fs";
import {ESLintUtils} from "@typescript-eslint/utils";

const ExampleDirPath = path.join(fileURLToPath(import.meta.url), '../../react-attr-autofix/examples');

function readTestFile(subPath: string) {
    return fs.readFileSync(path.resolve(ExampleDirPath, subPath)).toString()
}

export function getTestData(index: number) {

    return {
        content: [
            readTestFile(`../examples/test-${index}/in.tsx`),
            readTestFile(`../examples/test-${index}/out.tsx`),
        ],
        ExampleDirPath,
        fixPath: path.resolve(ExampleDirPath, `../examples/test-${index}/out.tsx`)
    }
}

export const createRule = ESLintUtils.RuleCreator(
    name => `https://example.com/rule/${name}`,
);