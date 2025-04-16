// API configuration
export const API_CONFIG = {
  // Base URL for API endpoints - use relative path to automatically match the protocol
  BASE_URL: '',  // Empty string means use relative URLs
  
  // Endpoints
  ENDPOINTS: {
    SETTINGS: '/api/settings',
    QUESTIONS: '/api/questions',
    ANSWERS: '/api/answers',
    HEALTH: '/api/health',
  },
};

// Ensure all API URLs are relative to automatically use the same protocol as the page
export const getApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};
