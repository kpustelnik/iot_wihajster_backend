/**
 * Navigation utilities for handling basePath correctly
 * GitHub Pages requires basePath prefix for all routes
 */

// Get the basePath from environment (set during build)
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/**
 * Prepend basePath to a path for use with window.location or other non-Next.js navigation
 * @param path - The path to navigate to (e.g., '/login')
 * @returns The full path with basePath prefix (e.g., '/iot_wihajster_backend/login')
 */
export function getFullPath(path: string): string {
    // If path already starts with basePath, return as-is
    if (basePath && path.startsWith(basePath)) {
        return path;
    }
    return `${basePath}${path}`;
}

/**
 * Navigate to a path using window.location (for non-React contexts)
 * Automatically adds basePath prefix
 * @param path - The path to navigate to
 */
export function navigateTo(path: string): void {
    if (typeof window !== 'undefined') {
        window.location.href = getFullPath(path);
    }
}
