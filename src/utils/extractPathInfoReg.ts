import {glob} from "glob";

const ExtractPathInfoReg = /\/([^\s\/]*)\/(in|out)\.tsx/;

/**
 * convert following file system:
 * - basePath
 *   - testA
 *      - in.tsx
 *      - out.tsx
 *
 * to
 *   [{ name: 'testA', paths: { in: 'testA/in.tsx', out: 'testA/out.tsx' }}]
 *
 * @param basePath
 */
export async function resolveTestPaths(basePath: string) {
    const pattern = `${basePath}/**/{in,out}.tsx`.replaceAll(/\\/g, '/');
    const filePaths = await glob(pattern);

    const pathMap = new Map<string, TestPaths>();
    // convert ['testA/in.tsx', 'testA/out.tsx'][] to { name: 'testA', paths: { in: 'testA/in.tsx', out: 'testA/out.tsx' }}[]
    const testPaths = filePaths.reduce<{ name: string, paths: TestPaths }[]>((group, filePath) => {
        filePath = filePath.replaceAll(/\\/g, '/');

        const matches = filePath.match(ExtractPathInfoReg);
        if (matches) {
            const [, name, _pathType] = matches;
            const pathType = _pathType as keyof TestPaths;

            const existPaths = pathMap.get(name);
            if (existPaths) {
                existPaths[pathType] = filePath;
            } else {
                const paths = {
                    [pathType]: filePath,
                } as TestPaths;

                pathMap.set(name, paths);

                group.push({
                    name,
                    paths,
                })
            }
        }

        return group;
    }, []);

    return testPaths;
}

type TestPaths = Record<'in' | 'out', string>;
