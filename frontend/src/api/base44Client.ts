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
    if (data.requires_pin) {
      return data;
    }
    setToken(data.access_token);
    return data.user;
  },

  async verifyPin(temporaryToken: string, pin: string) {
    const data = await request('/auth/verify-pin', {
      method: 'POST',
      body: JSON.stringify({ temporary_token: temporaryToken, pin }),
    });
    setToken(data.access_token);
    return data.user;
  },

  validateLicense: (licenseKey: string) =>
    request('/auth/validate-license', {
      method: 'POST',
      body: JSON.stringify({ license_key: licenseKey }),
    }),

  async registerCompany(payload: Record<string, unknown>) {
    const data = await request('/auth/register-company', {
      method: 'POST',
      body: JSON.stringify(payload),
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

const users = {
  list: () => request('/users'),
  create: (data: Record<string, unknown>) =>
    request('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, unknown>) =>
    request(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deactivate: (id: string) =>
    request(`/users/${id}`, {
      method: 'DELETE',
    }),
};

const functions = {
  invoke: (name: string, payload: Record<string, unknown> = {}) =>
    request(`/functions/${name}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((data) => ({ data })),
};

const aiManager = {
  chat: (message: string, conversationId?: string) =>
    request('/ai-manager/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversation_id: conversationId }),
    }),

  suggestions: () => request('/ai-manager/suggestions'),

  confirmAction: (id: string, payload: Record<string, unknown> = {}) =>
    request('/ai-manager/action/confirm', {
      method: 'POST',
      body: JSON.stringify({ id, payload }),
    }),
};

const costIntelligence = {
  ingredients: () => request('/cost-intelligence/ingredients'),
  createIngredient: (data: Record<string, unknown>) =>
    request('/cost-intelligence/ingredients', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateIngredient: (id: string, data: Record<string, unknown>) =>
    request(`/cost-intelligence/ingredients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteIngredient: (id: string) =>
    request(`/cost-intelligence/ingredients/${id}`, {
      method: 'DELETE',
    }),
  suppliers: () => request('/cost-intelligence/suppliers'),
  createSupplier: (data: Record<string, unknown>) =>
    request('/cost-intelligence/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  dishes: () => request('/cost-intelligence/dishes'),
  createDish: (data: Record<string, unknown>) =>
    request('/cost-intelligence/dishes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateDish: (id: string, data: Record<string, unknown>) =>
    request(`/cost-intelligence/dishes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteDish: (id: string) =>
    request(`/cost-intelligence/dishes/${id}`, {
      method: 'DELETE',
    }),
  recipes: () => request('/cost-intelligence/recipes'),
  createRecipeItem: (data: Record<string, unknown>) =>
    request('/cost-intelligence/recipes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteRecipeItem: (id: string) =>
    request(`/cost-intelligence/recipes/${id}`, {
      method: 'DELETE',
    }),
  dishCostBreakdown: (id: string) => request(`/cost-intelligence/dishes/${id}/cost-breakdown`),
  priceAdvice: () => request('/cost-intelligence/price-advice'),
  createInvoice: (data: Record<string, unknown>) =>
    request('/cost-intelligence/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  generateRecommendations: (targetMargin = 0.68) =>
    request('/cost-intelligence/recommendations/generate', {
      method: 'POST',
      body: JSON.stringify({ target_margin: targetMargin }),
    }),
  simulatePriceChange: (dishId: string, newPrice: number) =>
    request('/cost-intelligence/simulate-price-change', {
      method: 'POST',
      body: JSON.stringify({ dish_id: dishId, new_price: newPrice }),
    }),
  scanTicket: (data: { image_base64: string; mime_type: string; note?: string }) =>
    request('/cost-intelligence/ticket/scan', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  applyTicket: (data: Record<string, unknown>) =>
    request('/cost-intelligence/ticket/apply', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

const orders = {
  create: (data: Record<string, unknown>) =>
    request('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

const menu = {
  scan: (images: { image_base64: string; mime_type: string }[]) =>
    request('/menu/scan', {
      method: 'POST',
      body: JSON.stringify({ images }),
    }),
  apply: (dishes: Record<string, unknown>[]) =>
    request('/menu/apply', {
      method: 'POST',
      body: JSON.stringify({ dishes }),
    }),
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
  aiManager,
  costIntelligence,
  menu,
  orders,
  users,
  integrations,
  appLogs: {
    logUserInApp: async (_pageName: string) => ({ success: true }),
  },
};
