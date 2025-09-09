import path from "path";
import fs from "fs";
import {RULES_PATH} from "./paths";


function readTestFile(subPath: string) {
    const examplePath = path.resolve(RULES_PATH, subPath);
    return {
        path: examplePath,
        content: fs.readFileSync(examplePath).toString()
    }
}

export function resolveTestExample(ruleName: string, exampleName: string) {

    return {
        input: readTestFile(`./${ruleName}/test/${exampleName}/in.tsx`),
        out: readTestFile(`./${ruleName}/test/${exampleName}/out.tsx`),
    }
}

