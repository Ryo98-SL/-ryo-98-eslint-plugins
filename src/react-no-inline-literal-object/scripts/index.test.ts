import { RuleTester } from '@typescript-eslint/rule-tester';
import eslint from 'eslint';
import tslint from 'typescript-eslint'
import eslintjs from '@eslint/js';

import NoInlineLiteralObject from '../index.ts';
import path from 'path';
import * as test from 'bun:test';
import fs from 'fs';
import {getTestData} from "../utils.ts";


RuleTester.afterAll = test.afterAll;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;


const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 'latest',
        parserOptions: {
            projectService: {
                allowDefaultProject: ['*.ts*'],
            },
            ecmaFeatures: {
                jsx: true,
            },
            tsconfigRootDir: path.resolve(import.meta.url, '../../'),
        }
    },
});


const {content: testFileContents} = getTestData(1)


ruleTester.run(
    "no-inline-object-literals",
    NoInlineLiteralObject.rules["no-inline-object-literals"],
    {
    valid: [
        ``
    ],
    invalid: [
        {
            filename: 'dummy.tsx',
            code: testFileContents[0],
            errors: [
                {
                    messageId: 'noInline',
                    suggestions: [
                        {
                            messageId: 'fixWithUseMemo',
                            output: testFileContents[1],
                        }
                    ]
                }
            ],
        }
    ]
})
