import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Users, Download, FileSpreadsheet, ChevronDown, ChevronUp, Calendar, Star, Clock } from 'lucide-react';
import { api } from '../services/api.js';
import { Modal } from '../components/ui/Modal.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { PageLoader } from '../components/ui/LoadingSpinner.js';
import { StarRating } from '../components/ui/StarRating.js';
import { useAuthStore } from '../store/auth.store.js';
import { exportEmployeesToPdf, exportEmployeesToExcel } from '../utils/exportEmployees.js';
import { CONTRACT_TYPES, EMPLOYEE_STATUSES } from '@planning/shared';
import type { EmployeeWithDetails, Unavailability, ContractType, EmployeeStatus } from '@planning/shared';
import toast from 'react-hot-toast';

const contractColors: Record<ContractType, string> = {
  CDI: 'badge-green', CDD: 'badge-blue', Extra: 'badge-yellow', Saisonnier: 'badge-purple',
};

const dayLabels: Record<string, string> = {
  lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu',
  vendredi: 'Ven', samedi: 'Sam', dimanche: 'Dim',
};

export function EmployeesPage() {
  const { user } = useAuthStore();
  const [employees, setEmployees] = useState<EmployeeWithDetails[]>([]);
  const [unavailabilities, setUnavailabilities] = useState<Map<number, Unavailability[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterContract, setFilterContract] = useState<ContractType | ''>('');
  const [filterStatus, setFilterStatus] = useState<EmployeeStatus | ''>('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState<'pdf' | 'excel' | null>(null);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    hireDate: new Date().toISOString().substring(0, 10),
    contractType: 'CDI' as ContractType, status: 'actif' as EmployeeStatus,
  });
  const [saving, setSaving] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      const detailed = await api.get<EmployeeWithDetails[]>('/employees?detailed=true');
      setEmployees(detailed);

      // Charger les indisponibilités de chaque employé
      const unavMap = new Map<number, Unavailability[]>();
      await Promise.all(
        detailed.map(async (emp) => {
          try {
            const unavs = await api.get<Unavailability[]>(`/employees/${emp.id}/unavailabilities`);
            unavMap.set(emp.id, unavs);
          } catch {
            unavMap.set(emp.id, []);
          }
        }),
      );
      setUnavailabilities(unavMap);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  // Fermer le menu export au clic ailleurs
  useEffect(() => {
    const handleClick = () => setExportMenuOpen(null);
    if (exportMenuOpen) document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [exportMenuOpen]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post('/employees', form);
      toast.success('Employé ajouté');
      setModalOpen(false);
      fetchEmployees();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    if (expandedIds.size === filtered.length) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(filtered.map((e) => e.id)));
    }
  };

  const filtered = employees.filter((e) => {
    const name = `${e.firstName} ${e.lastName}`.toLowerCase();
    if (search && !name.includes(search.toLowerCase()) && !e.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterContract && e.contractType !== filterContract) return false;
    if (filterStatus && e.status !== filterStatus) return false;
    return true;
  });

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canExportFull = isAdmin || isManager;

  const handleExport = (format: 'pdf' | 'excel', full: boolean) => {
    setExportMenuOpen(null);
    if (format === 'pdf') {
      exportEmployeesToPdf(filtered, full);
    } else {
      exportEmployeesToExcel(filtered, full);
    }
  };

  const renderUnavailability = (u: Unavailability) => {
    if (u.type === 'full_day') return `${u.date ? new Date(u.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''} (journée)`;
    if (u.type === 'time_slot') return `${u.date ? new Date(u.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''} ${u.startTime}–${u.endTime}`;
    if (u.type === 'recurring') return `Chaque ${dayLabels[u.dayOfWeek || ''] || u.dayOfWeek}${u.startTime ? ` ${u.startTime}–${u.endTime}` : ''}`;
    return '';
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Employés</h1>
          <p className="text-gray-500 mt-1">{employees.length} employé(s) enregistré(s)</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export PDF */}
          <div className="relative">
            {canExportFull ? (
              <>
                <button onClick={(e) => { e.stopPropagation(); setExportMenuOpen(exportMenuOpen === 'pdf' ? null : 'pdf'); }}
                  className="btn-secondary">
                  <Download className="w-4 h-4" /> PDF <ChevronDown className="w-3 h-3" />
                </button>
                {exportMenuOpen === 'pdf' && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleExport('pdf', false)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 rounded-t-lg">
                      Export simplifié
                      <span className="block text-xs text-gray-400">Sans statut</span>
                    </button>
                    <button onClick={() => handleExport('pdf', true)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 rounded-b-lg border-t border-gray-100">
                      Export complet
                      <span className="block text-xs text-gray-400">Avec statut</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button onClick={() => handleExport('pdf', false)} className="btn-secondary">
                <Download className="w-4 h-4" /> PDF
              </button>
            )}
          </div>

          {/* Export Excel */}
          <div className="relative">
            {canExportFull ? (
              <>
                <button onClick={(e) => { e.stopPropagation(); setExportMenuOpen(exportMenuOpen === 'excel' ? null : 'excel'); }}
                  className="btn-secondary">
                  <FileSpreadsheet className="w-4 h-4" /> Excel <ChevronDown className="w-3 h-3" />
                </button>
                {exportMenuOpen === 'excel' && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[220px]" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleExport('excel', false)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 rounded-t-lg">
                      Export simplifié
                      <span className="block text-xs text-gray-400">Sans statut, sans récapitulatif</span>
                    </button>
                    <button onClick={() => handleExport('excel', true)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 rounded-b-lg border-t border-gray-100">
                      Export complet
                      <span className="block text-xs text-gray-400">Avec statut et récapitulatif</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button onClick={() => handleExport('excel', false)} className="btn-secondary">
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </button>
            )}
          </div>

          <button onClick={() => setModalOpen(true)} className="btn-primary"><Plus className="w-4 h-4" /> Ajouter</button>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Rechercher par nom ou email..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="input pl-10" />
          </div>
          <select value={filterContract} onChange={(e) => setFilterContract(e.target.value as ContractType | '')}
            className="input w-auto">
            <option value="">Tous les contrats</option>
            {CONTRACT_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as EmployeeStatus | '')}
            className="input w-auto">
            <option value="">Tous les statuts</option>
            {EMPLOYEE_STATUSES.map((s) => <option key={s} value={s}>{s === 'actif' ? 'Actif' : 'Inactif'}</option>)}
          </select>
          <button onClick={expandAll} className="btn-secondary btn-sm whitespace-nowrap">
            {expandedIds.size === filtered.length ? 'Tout réduire' : 'Tout déplier'}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="Aucun employé" description="Commencez par ajouter vos employés."
          action={{ label: 'Ajouter un employé', onClick: () => setModalOpen(true) }} />
      ) : (
        <div className="space-y-3">
          {filtered.map((emp) => {
            const isExpanded = expandedIds.has(emp.id);
            const empUnavs = unavailabilities.get(emp.id) || [];
            return (
              <div key={emp.id} className="card overflow-hidden hover:shadow-md transition-shadow">
                {/* Ligne principale */}
                <div className="flex items-center px-5 py-4 cursor-pointer" onClick={() => toggleExpand(emp.id)}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                      {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <Link to={`/employees/${emp.id}`} className="font-semibold hover:text-primary-600 transition-colors"
                        onClick={(e) => e.stopPropagation()}>
                        {emp.firstName} {emp.lastName}
                      </Link>
                      <p className="text-xs text-gray-400">{emp.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {emp.skillRatings.length > 0 && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Star className="w-3 h-3" /> {emp.skillRatings.length}
                      </span>
                    )}
                    {empUnavs.length > 0 && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {empUnavs.length}
                      </span>
                    )}
                    <span className={contractColors[emp.contractType]}>{emp.contractType}</span>
                    <span className={emp.status === 'actif' ? 'badge-green' : 'badge-red'}>
                      {emp.status === 'actif' ? 'Actif' : 'Inactif'}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(emp.hireDate).toLocaleDateString('fr-FR')}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {/* Détail déplié : compétences + disponibilités */}
                {isExpanded && (
                  <div className="px-5 pb-4 border-t border-gray-100 pt-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Compétences */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 text-amber-500" /> Compétences
                        </h4>
                        {emp.skillRatings.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">Aucune compétence renseignée</p>
                        ) : (
                          <div className="space-y-1">
                            {emp.skillRatings.sort((a, b) => b.rating - a.rating).map((sr) => (
                              <div key={sr.skillId} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5">
                                <span className="text-sm text-gray-700">{sr.skillName}</span>
                                <StarRating value={sr.rating} readonly size="sm" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Disponibilités */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-red-500" /> Indisponibilités
                        </h4>
                        {empUnavs.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">Aucune indisponibilité déclarée</p>
                        ) : (
                          <div className="space-y-1">
                            {empUnavs.map((u) => (
                              <div key={u.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  u.type === 'recurring' ? 'bg-purple-400' : u.type === 'full_day' ? 'bg-red-400' : 'bg-amber-400'
                                }`} />
                                <span className="text-sm text-gray-700">{renderUnavailability(u)}</span>
                                {u.reason && <span className="text-xs text-gray-400 ml-auto">({u.reason})</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Limites horaires */}
                        {emp.workLimits && (
                          <div className="mt-3">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-blue-500" /> Limites horaires
                            </h4>
                            <div className="flex gap-3 text-xs">
                              {emp.workLimits.maxHoursPerDay && (
                                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">{emp.workLimits.maxHoursPerDay}h/jour</span>
                              )}
                              {emp.workLimits.maxHoursPerWeek && (
                                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">{emp.workLimits.maxHoursPerWeek}h/sem</span>
                              )}
                              {emp.workLimits.maxHoursPerMonth && (
                                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">{emp.workLimits.maxHoursPerMonth}h/mois</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nouvel employé" size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Prénom</label>
            <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
          <div><label className="label">Nom</label>
            <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
          <div><label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">Téléphone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="label">Date d'embauche</label>
            <input type="date" className="input" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} /></div>
          <div><label className="label">Type de contrat</label>
            <select className="input" value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value as ContractType })}>
              {CONTRACT_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select></div>
        </div>
        <div className="flex justify-end gap-3 pt-6">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Annuler</button>
          <button onClick={handleCreate} disabled={saving || !form.firstName || !form.lastName || !form.email}
            className="btn-primary">{saving ? 'Enregistrement...' : 'Créer'}</button>
        </div>
      </Modal>
    </div>
  );
}
