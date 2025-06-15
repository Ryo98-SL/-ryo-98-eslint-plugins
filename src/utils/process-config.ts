import {RegExpConfig} from "./types.ts";
import path from "path";
import fs from "fs";
import {CompilerOptions} from "typescript";

/**
 * Check if component name should be ignored
 * @param componentName - Component name
 * @param ignoredComponentsExact - Set of exact component names to ignore
 * @param ignoredComponentsRegex - Array of regex patterns to check
 * @returns true if component should be ignored
 */
export function shouldIgnoreComponent(
    componentName: string,
    ignoredComponentsExact: Set<string>,
    ignoredComponentsRegex: RegExp[]
): boolean {
    // Check exact match
    if (ignoredComponentsExact.has(componentName)) {
        return true;
    }

    // Check regex match
    for (const regex of ignoredComponentsRegex) {
        if (regex.test(componentName)) {
            return true;
        }
    }

    return false;
}

/**
 * Process ignored components configuration
 * @param ignoredComponentsConfig - Configuration for ignored components
 * @returns Object with sets of ignored components
 */
export const processIgnoredComponentsConfig = (ignoredComponentsConfig: (string | RegExpConfig)[]): {
    ignoredComponentsExact: Set<string>;
    ignoredComponentsRegex: RegExp[];
} => {
    const ignoredComponentsExact = new Set<string>();
    const ignoredComponentsRegex: RegExp[] = [];

    ignoredComponentsConfig.forEach(config => {
        if (typeof config === 'string') {
            // Add string directly to exact match set
            ignoredComponentsExact.add(config);
        } else if (config && (config as RegExpConfig).pattern) {
            // Convert object config to RegExp
            try {
                const regexConfig = config as RegExpConfig;
                const regex = new RegExp(regexConfig.pattern, regexConfig.flags || '');
                ignoredComponentsRegex.push(regex);
            } catch (e) {
                // Invalid regex config, log warning
                console.warn(`Invalid regex pattern in ignoredComponents: ${(config as RegExpConfig).pattern}`);
            }
        }
    });

    return {ignoredComponentsExact, ignoredComponentsRegex};
};

export function findTsConfigPath(startDir: string, configName = 'tsconfig.json') {
    let currentDir = path.resolve(startDir);

    while (currentDir !== path.dirname(currentDir)) {
        const configPath = path.join(currentDir, configName);

        if (fs.existsSync(configPath)) {
            return configPath;
        }

        currentDir = path.dirname(currentDir);
    }

    return null;
}


/**
 * 将路径与 tsconfig.json 中的 paths 匹配并转换为 alias 形式
 * @param {string} inputPath - 输入路径（可能是绝对路径或相对路径）
 * @param {string} tsConfigPath - tsconfig.json 的路径
 * @param {string} currentFilePath - 当前文件的路径（用于解析相对路径）
 * @returns {string|null} 转换后的 alias 路径，如果无法匹配返回 null
 */
export function resolvePathToAlias(inputPath: string, tsConfigPath: string, tsCompilerOptions: CompilerOptions , currentFilePath: string) {

    const { paths, baseUrl = '.' } = tsCompilerOptions;
    const tsConfigDir = path.dirname(tsConfigPath);
    const baseUrlPath = bestPracticeNormalize(path.resolve(tsConfigDir, baseUrl));


    if(!paths) return null;

    // 将输入路径转换为绝对路径
    let absolutePath;
    if (path.isAbsolute(inputPath)) {
        absolutePath = inputPath;
    } else {
        absolutePath = path.resolve(path.dirname(currentFilePath), inputPath);
    }

    // 尝试匹配每个 path mapping
    for (const [alias, mappings] of Object.entries(paths)) {
        for (const mapping of mappings) {
            // 处理通配符
            const mappingPath = mapping.replace('*', '$1');
            const fullMappingPath = bestPracticeNormalize(path.resolve(baseUrlPath, mappingPath));


            // 检查是否是简单的 alias（不包含通配符）
            if (!alias.includes('*')) {
                const exactMappingPath = path.resolve(baseUrlPath, mapping);
                if (absolutePath.startsWith(exactMappingPath)) {
                    const relativePart = path.relative(exactMappingPath, absolutePath);
                    return relativePart ? `${alias}/${relativePart}` : alias;
                }
            } else {
                // 处理通配符匹配
                const mappingDir = path.dirname(fullMappingPath);
                if (absolutePath.startsWith(mappingDir)) {
                    const relativePart = path.relative(mappingDir, absolutePath);
                    const aliasBase = alias.replace('/*', '');
                    return `${aliasBase}/${relativePart}`;
                }
            }
        }
    }

    return null;
}

// 在实际项目中使用的最佳实践
function bestPracticeNormalize(filePath) {
    if (!filePath) return '';

    // 1. 处理路径规范化
    let normalized = path.normalize(filePath);

    // 2. 统一使用正斜杠
    normalized = normalized.split(path.sep).join('/');

    // 3. 清理多余的斜杠
    normalized = normalized.replace(/\/+/g, '/');

    // 4. 处理末尾斜杠（可选）
    if (normalized.endsWith('/') && normalized.length > 1) {
        normalized = normalized.slice(0, -1);
    }

    return normalized;
}