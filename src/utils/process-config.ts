import {RegExpConfig} from "./types.ts";

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