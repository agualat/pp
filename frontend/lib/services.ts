import { api } from './api';

export interface Server {
  id: number;
  name: string;
  ip_address: string;
  status: string;
  ssh_user: string;
  ssh_private_key_path: string | null;
}

export interface Metric {
  id: number;
  server_id: number;
  cpu_usage: string;
  memory_usage: string;
  disk_usage: string;
  gpu_usage: string;
  timestamp: string;
}

export interface Playbook {
  id: number;
  name: string;
  playbook: string;
  inventory: string;
}

export interface Execution {
  id: number;
  playbook_id: number;
  user_id: number;
  servers: number[];
  executed_at: string;
  state: string;
}

// Servidores
export const serversService = {
  async getAll() {
    const response = await api.get<Server[]>('/servers/');
    return response.data;
  },

  async getById(id: number) {
    const response = await api.get<Server>(`/servers/${id}`);
    return response.data;
  },

  async create(data: { name: string; ip_address: string; ssh_user: string; ssh_password: string }) {
    const response = await api.post<Server>('/servers/', data);
    return response.data;
  },

  async updateStatus(id: number, status: string) {
    const response = await api.put<Server>(`/servers/${id}/status`, { status });
    return response.data;
  },

  async setOnline(id: number) {
    const response = await api.put<Server>(`/servers/${id}/online`);
    return response.data;
  },

  async setOffline(id: number) {
    const response = await api.put<Server>(`/servers/${id}/offline`);
    return response.data;
  },

  async delete(id: number) {
    await api.delete(`/servers/${id}`);
  },

  async getMetrics(id: number) {
    const response = await api.get<Metric[]>(`/servers/${id}/metrics`);
    return response.data;
  },

  async countTotal() {
    const response = await api.get<{ count: number }>('/servers/count/total');
    return response.data;
  },

  async countByStatus(status: string) {
    const response = await api.get<{ count: number }>(`/servers/count/by-status/${status}`);
    return response.data;
  },
};

// Playbooks
export const playbooksService = {
  async getAll() {
    const response = await api.get<Playbook[]>('/ansible/playbooks');
    return response.data;
  },

  async getById(id: number) {
    const response = await api.get<Playbook>(`/ansible/playbooks/${id}`);
    return response.data;
  },

  async create(data: { name: string; playbook: string; inventory: string }) {
    const response = await api.post<Playbook>('/ansible/playbooks', data);
    return response.data;
  },

  async update(id: number, data: Partial<Playbook>) {
    const response = await api.patch<Playbook>(`/ansible/playbooks/${id}`, data);
    return response.data;
  },

  async delete(id: number) {
    await api.delete(`/ansible/playbooks/${id}`);
  },

  async run(id: number, serverIds: number[]) {
    const response = await api.post(`/ansible/playbooks/${id}/run`, serverIds, {
      params: { server_ids: serverIds.join(',') }
    });
    return response.data;
  },

  async count() {
    const response = await api.get<{ count: number }>('/ansible/playbooks/count');
    return response.data;
  },
};

// Ejecuciones
export const executionsService = {
  async getAll() {
    const response = await api.get<Execution[]>('/executions/');
    return response.data;
  },

  async getById(id: number) {
    const response = await api.get<Execution>(`/executions/${id}`);
    return response.data;
  },

  async getByPlaybook(playbookId: number) {
    const response = await api.get<Execution[]>(`/executions/by-playbook/${playbookId}`);
    return response.data;
  },

  async getByState(state: string) {
    const response = await api.get<Execution[]>(`/executions/by-state/${state}`);
    return response.data;
  },

  async countTotal() {
    const response = await api.get<{ count: number }>('/executions/count/total');
    return response.data;
  },

  async countByState(state: string) {
    const response = await api.get<{ count: number }>(`/executions/count/by-state/${state}`);
    return response.data;
  },
};
