/**
 * Measurements API Client
 * 
 * Typed API functions for measurement-related operations.
 */

import axios from '../AxiosClient';
import { API_ENDPOINTS } from './endpoints';
import type {
    MeasurementModel,
    MeasurementQueryParams,
    LimitedResponse,
} from './schemas';

export const measurementsApi = {
    /**
     * Get measurements with optional filters
     */
    getMeasurements: async (params?: MeasurementQueryParams) => {
        const response = await axios.get<LimitedResponse<MeasurementModel>>(
            API_ENDPOINTS.measurements.list,
            { params }
        );
        return response.data;
    },
};
