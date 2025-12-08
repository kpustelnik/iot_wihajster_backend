/**
 * Feature Flags
 * 
 * Centralized feature flag configuration for toggling experimental features.
 * Use environment variables to control feature availability.
 */

/**
 * Check if experimental features are enabled
 * @returns true if NEXT_PUBLIC_EXPERIMENTAL_FEATURES is set to 'true'
 */
export function isExperimentalFeaturesEnabled(): boolean {
    return process.env.NEXT_PUBLIC_EXPERIMENTAL_FEATURES === 'true';
}
