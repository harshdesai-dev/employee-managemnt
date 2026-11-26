const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${apiBase}/api${path}`, {
      credentials: 'include',
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    if (options.signal?.aborted) throw new DOMException('Request aborted.', 'AbortError');
    const error = new Error('Unable to reach PeopleOS. Check your connection and try again.');
    error.status = 0;
    throw error;
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/me') window.dispatchEvent(new Event('peopleos:unauthorized'));
    const error = new Error(response.status >= 500 ? 'PeopleOS could not complete the request. Try again shortly.' : data.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}


export const api = {
  me: () => request('/auth/me'),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  stats: () => request('/dashboard/stats'),
  employees: (params, options = {}) => request(`/employees?${new URLSearchParams(params)}`, options),
  async allEmployees(filters) {
    const first = await request(`/employees?${new URLSearchParams({ ...filters, page: 1, limit: 50 })}`);
    const records = [...first.employees];
    for (let page = 2; page <= first.pagination.pages; page += 1) {
      const result = await request(`/employees?${new URLSearchParams({ ...filters, page, limit: 50 })}`);
      records.push(...result.employees);
    }
    return records;
  },
  create: (body) => request('/employees', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id) => request(`/employees/${id}`, { method: 'DELETE' }),
};
