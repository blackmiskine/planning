import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Users } from 'lucide-react';
import { api } from '../services/api.js';
import { Modal } from '../components/ui/Modal.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { PageLoader } from '../components/ui/LoadingSpinner.js';
import { CONTRACT_TYPES, EMPLOYEE_STATUSES } from '@planning/shared';
import type { Employee, ContractType, EmployeeStatus } from '@planning/shared';
import toast from 'react-hot-toast';

const contractColors: Record<ContractType, string> = {
  CDI: 'badge-green', CDD: 'badge-blue', Extra: 'badge-yellow', Saisonnier: 'badge-purple',
};

export function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterContract, setFilterContract] = useState<ContractType | ''>('');
  const [filterStatus, setFilterStatus] = useState<EmployeeStatus | ''>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    hireDate: new Date().toISOString().substring(0, 10),
    contractType: 'CDI' as ContractType, status: 'actif' as EmployeeStatus,
  });
  const [saving, setSaving] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await api.get<Employee[]>('/employees');
      setEmployees(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

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

  const filtered = employees.filter((e) => {
    const name = `${e.firstName} ${e.lastName}`.toLowerCase();
    if (search && !name.includes(search.toLowerCase()) && !e.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterContract && e.contractType !== filterContract) return false;
    if (filterStatus && e.status !== filterStatus) return false;
    return true;
  });

  if (loading) return <PageLoader />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Employés</h1>
          <p className="text-gray-500 mt-1">{employees.length} employé(s) enregistré(s)</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary"><Plus className="w-4 h-4" /> Ajouter</button>
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
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="Aucun employé" description="Commencez par ajouter vos employés."
          action={{ label: 'Ajouter un employé', onClick: () => setModalOpen(true) }} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employé</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contrat</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Embauche</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link to={`/employees/${emp.id}`} className="flex items-center gap-3 group">
                      <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm">
                        {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                      </div>
                      <span className="font-medium group-hover:text-primary-600 transition-colors">
                        {emp.firstName} {emp.lastName}
                      </span>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{emp.email}</td>
                  <td className="px-6 py-4"><span className={contractColors[emp.contractType]}>{emp.contractType}</span></td>
                  <td className="px-6 py-4">
                    <span className={emp.status === 'actif' ? 'badge-green' : 'badge-red'}>
                      {emp.status === 'actif' ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(emp.hireDate).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
