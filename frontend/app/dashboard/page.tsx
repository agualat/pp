'use client';

import { useEffect, useState } from 'react';
import { serversService, playbooksService, executionsService } from '@/lib/services';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalServers: 0,
    onlineServers: 0,
    offlineServers: 0,
    totalPlaybooks: 0,
    totalExecutions: 0,
    successExecutions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [
        totalServers,
        onlineServers,
        offlineServers,
        totalPlaybooks,
        totalExecutions,
        successExecutions,
      ] = await Promise.all([
        serversService.countTotal(),
        serversService.countByStatus('online'),
        serversService.countByStatus('offline'),
        playbooksService.count(),
        executionsService.countTotal(),
        executionsService.countByState('success'),
      ]);

      setStats({
        totalServers: totalServers.count,
        onlineServers: onlineServers.count,
        offlineServers: offlineServers.count,
        totalPlaybooks: totalPlaybooks.count,
        totalExecutions: totalExecutions.count,
        successExecutions: successExecutions.count,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Resumen general del sistema</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Total Servidores"
          value={stats.totalServers}
          icon="server"
          color="blue"
        />
        <StatCard
          title="Servidores Online"
          value={stats.onlineServers}
          icon="online"
          color="green"
        />
        <StatCard
          title="Servidores Offline"
          value={stats.offlineServers}
          icon="offline"
          color="red"
        />
        <StatCard
          title="Total Playbooks"
          value={stats.totalPlaybooks}
          icon="playbook"
          color="purple"
        />
        <StatCard
          title="Total Ejecuciones"
          value={stats.totalExecutions}
          icon="executions"
          color="yellow"
        />
        <StatCard
          title="Ejecuciones Exitosas"
          value={stats.successExecutions}
          icon="success"
          color="green"
        />
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickAction
            href="/dashboard/servers"
            icon="server"
            title="Ver Servidores"
            description="Administrar servidores del sistema"
          />
          <QuickAction
            href="/dashboard/playbooks"
            icon="playbook"
            title="Ver Playbooks"
            description="Gestionar playbooks de Ansible"
          />
          <QuickAction
            href="/dashboard/executions"
            icon="history"
            title="Ver Historial"
            description="Revisar ejecuciones pasadas"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: string; color: string }) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    yellow: 'bg-yellow-500',
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'server':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />;
      case 'online':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />;
      case 'offline':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />;
      case 'playbook':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />;
      case 'executions':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />;
      case 'success':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />;
      default:
        return null;
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-full ${colorClasses[color as keyof typeof colorClasses]} flex items-center justify-center`}>
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {getIcon(icon)}
          </svg>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ href, icon, title, description }: { href: string; icon: string; title: string; description: string }) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'server':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />;
      case 'playbook':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />;
      case 'history':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />;
      default:
        return null;
    }
  };

  return (
    <a
      href={href}
      className="block p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all group"
    >
      <div className="flex items-start space-x-3">
        <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center group-hover:bg-primary-600 transition-colors">
          <svg className="w-6 h-6 text-primary-600 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {getIcon(icon)}
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 group-hover:text-primary-600">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
      </div>
    </a>
  );
}
