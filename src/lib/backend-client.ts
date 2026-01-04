import axios, { AxiosInstance } from 'axios'

/**
 * Creates an axios client configured for the public backend.
 * - baseURL is taken from NEXT_PUBLIC_BACKEND_URL
 * - Attaches Authorization Bearer token from providedToken or localStorage('token')
 * - Sets accept header to application/json
 */
export function createBackendClient(providedToken?: string | null): AxiosInstance {
  const client = axios.create({
    baseURL: process.env.NEXT_PUBLIC_BACKEND_URL,
  })

  client.interceptors.request.use((config) => {
    const token = providedToken ?? (typeof window !== 'undefined' ? localStorage.getItem('token') : null)
    if (token) {
      config.headers = config.headers || {}
      config.headers['Authorization'] = `Bearer ${token}`
      config.headers['ngrok-skip-browser-warning'] = 'true'
    }
    config.headers = config.headers || {}
    // Do not set a default Content-Type here so FormData uploads can set their own
    config.headers['accept'] = 'application/json'
    return config
  })

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401 && typeof window !== 'undefined') {
        window.location.href = '/auth/login'
      }
      return Promise.reject(error)
    }
  )

  return client
}


