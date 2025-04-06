import ts, {ScriptTarget} from 'typescript';

import fs from 'fs';
import path from 'path';
import {ROOT_PATH} from "../paths";


const configPath = path.resolve(ROOT_PATH, './tsconfig.json');

const config = fs.readFileSync(configPath).toString();
console.log("=>(direct-import.ts:13) config", config);

const program = ts.createProgram({
    rootNames: ["./demo/demo.ts",],
    options: {

    }
});


console.log("=>(direct-import.ts:13) program.getSourceFile('demo.ts')", program.getSourceFiles().length);