/**
 * API Client
 * 
 * Central export point for all API functions and schemas.
 * Import from this file to access any API functionality.
 * 
 * @example
 * import { devicesApi, usersApi } from '@/lib/api';
 * import type { DeviceModel, UserModel } from '@/lib/api';
 */

// Export all API clients
export { devicesApi } from './devices';
export { usersApi } from './users';
export { familiesApi } from './families';
export { measurementsApi } from './measurements';

// Export all schemas and types
export * from './schemas';

// Export endpoints (useful for debugging or direct access)
export { API_ENDPOINTS } from './endpoints';
