import url from "url";
import path from "path";

export const ROOT_PATH = (() => {
    const currentDirectory = url.fileURLToPath(new URL('.', import.meta.url));
    const workspaceRoot = path.resolve(currentDirectory, '../../');
    return workspaceRoot;
})();

