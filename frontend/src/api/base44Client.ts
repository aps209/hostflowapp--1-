const API_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'hostflow_access_token';

type SortDirection = 'asc' | 'desc';

const getToken = () => localStorage.getItem(TOKEN_KEY);

const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);

const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error(data?.detail || data?.error || 'Error de API') as Error & {
      status?: number;
      response?: { status: number; data: unknown };
      data?: unknown;
    };
    error.status = response.status;
    error.data = data;
    error.response = { status: response.status, data };
    throw error;
  }

  return data;
}

const buildQuery = (params: Record<string, unknown>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

const normalizeSort = (sort?: string) => {
  if (!sort) return {};
  const direction: SortDirection = sort.startsWith('-') ? 'desc' : 'asc';
  const field = sort.replace(/^-/, '');
  return { sort: field, direction };
};

const entityClient = (entityName: string) => ({
  list: (sort?: string, limit?: number) =>
    request(`/entities/${entityName}${buildQuery({ ...normalizeSort(sort), limit })}`),

  filter: (filters = {}, sort?: string, limit?: number) =>
    request(`/entities/${entityName}/filter${buildQuery({ filters, ...normalizeSort(sort), limit })}`),

  get: (id: string) => request(`/entities/${entityName}/${id}`),

  create: (data: Record<string, unknown>) =>
    request(`/entities/${entityName}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  bulkCreate: (items: Record<string, unknown>[]) =>
    request(`/entities/${entityName}/bulk`, {
      method: 'POST',
      body: JSON.stringify(items),
    }),

  update: (id: string, data: Record<string, unknown>) =>
    request(`/entities/${entityName}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request(`/entities/${entityName}/${id}`, {
      method: 'DELETE',
    }),
});

const entities = new Proxy(
  {},
  {
    get: (_target, prop: string) => entityClient(prop),
  },
) as Record<string, ReturnType<typeof entityClient>>;

const auth = {
  async login(email: string, password: string) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.access_token);
    return data.user;
  },

  async register(payload: { nombre: string; email: string; password: string }) {
    const data = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setToken(data.access_token);
    return data.user;
  },

  me: () => request('/auth/me'),

  logout(redirectTo?: string) {
    clearToken();
    if (redirectTo) {
      window.location.href = '/Login';
    }
  },

  redirectToLogin(returnTo?: string) {
    const suffix = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
    window.location.href = `/Login${suffix}`;
  },

  asServiceRole: {
    entities,
  },
};

const functions = {
  invoke: (name: string, payload: Record<string, unknown> = {}) =>
    request(`/functions/${name}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((data) => ({ data })),
};

const integrations = {
  Core: {
    InvokeLLM: async () => ({ success: false, message: 'Integracion LLM no configurada en local.' }),
    SendEmail: async () => ({ success: true }),
    SendSMS: async () => ({ success: true }),
    UploadFile: async () => ({ file_url: '' }),
    GenerateImage: async () => ({ url: '' }),
    ExtractDataFromUploadedFile: async () => ({ data: null }),
  },
};

export const base44 = {
  auth,
  entities,
  functions,
  integrations,
  appLogs: {
    logUserInApp: async (_pageName: string) => ({ success: true }),
  },
};
