import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Star, Briefcase, Calendar, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { api } from '../services/api.js';
import { PageLoader } from '../components/ui/LoadingSpinner.js';

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  totalPositions: number;
  totalSkills: number;
  activePlannings: number;
  recentAlerts: { type: string; severity: string; message: string }[];
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardStats>('/plannings/dashboard').then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading || !stats) return <PageLoader />;

  const cards = [
    { label: 'Employ\u00e9s actifs', value: stats.activeEmployees, total: stats.totalEmployees, icon: Users, color: 'bg-blue-500', link: '/employees' },
    { label: 'Comp\u00e9tences', value: stats.totalSkills, icon: Star, color: 'bg-amber-500', link: '/skills' },
    { label: 'Postes', value: stats.totalPositions, icon: Briefcase, color: 'bg-purple-500', link: '/positions' },
    { label: 'Plannings actifs', value: stats.activePlannings, icon: Calendar, color: 'bg-emerald-500', link: '/plannings' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-500 mt-1">Vue d'ensemble de votre \u00e9tablissement</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card) => (
          <Link key={card.label} to={card.link} className="card p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
              <TrendingUp className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-sm text-gray-500">
              {card.label}
              {card.total !== undefined && card.total !== card.value && (
                <span className="text-gray-400"> / {card.total} total</span>
              )}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Alertes r\u00e9centes
          </h2>
          {stats.recentAlerts.length === 0 ? (
            <div className="flex items-center gap-3 py-8 justify-center text-gray-400">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <span className="text-sm">Aucune alerte en cours</span>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentAlerts.map((alert, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${
                  alert.severity === 'error' ? 'bg-red-50' : 'bg-amber-50'
                }`}>
                  <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                    alert.severity === 'error' ? 'text-red-500' : 'text-amber-500'
                  }`} />
                  <span className="text-sm">{alert.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Actions rapides</h2>
          <div className="space-y-3">
            <Link to="/plannings" className="flex items-center gap-3 p-3 rounded-lg bg-primary-50 hover:bg-primary-100 transition-colors">
              <Calendar className="w-5 h-5 text-primary-600" />
              <div>
                <p className="text-sm font-medium text-primary-900">Cr\u00e9er un planning</p>
                <p className="text-xs text-primary-600">G\u00e9n\u00e9rer un nouveau planning pour la semaine</p>
              </div>
            </Link>
            <Link to="/employees" className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
              <Users className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">G\u00e9rer les employ\u00e9s</p>
                <p className="text-xs text-blue-600">Ajouter ou modifier les profils employ\u00e9s</p>
              </div>
            </Link>
            <Link to="/positions" className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors">
              <Briefcase className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-purple-900">Configurer les postes</p>
                <p className="text-xs text-purple-600">D\u00e9finir les postes et leurs exigences</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
