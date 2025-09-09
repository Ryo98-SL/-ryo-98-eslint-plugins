import { defineConfig } from '@rslib/core';

export default defineConfig({
    lib: [
        {
            format: 'esm',
            bundle: false,
            dts: {
                bundle: false,
                distPath: './dist',
                abortOnError: false,
            },
            output: {
                distPath: {
                    root: './dist',
                },
            },
        },
    ],
    source: {
        tsconfigPath: './tsconfig.build.json',
        entry: {
            index: ["src/index.ts", "src/utils/**/*.ts", "src/rules/**/rule.ts"],
        },
    },
});