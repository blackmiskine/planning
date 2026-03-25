import { useEffect, useState, useCallback } from 'react';
import { Save, Settings, Shield } from 'lucide-react';
import { api } from '../services/api.js';
import { PageLoader } from '../components/ui/LoadingSpinner.js';
import { Modal } from '../components/ui/Modal.js';
import { useAuthStore } from '../store/auth.store.js';
import { USER_ROLES } from '@planning/shared';
import type { EstablishmentSettings, User, UserRole } from '@planning/shared';
import toast from 'react-hot-toast';

export function SettingsPage() {
  const { user: currentUser } = useAuthStore();
  const [settings, setSettings] = useState<EstablishmentSettings | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    establishmentName: '', defaultMaxHoursPerDay: 10,
    defaultMaxHoursPerWeek: 44, defaultMaxHoursPerMonth: 176,
  });

  const [userModal, setUserModal] = useState(false);
  const [userForm, setUserForm] = useState({
    email: '', password: '', name: '', role: 'consultation' as UserRole,
  });

  const fetchData = useCallback(async () => {
    try {
      const [s, u] = await Promise.all([
        api.get<EstablishmentSettings>('/plannings/settings'),
        currentUser?.role === 'admin' ? api.get<User[]>('/auth/users') : Promise.resolve([]),
      ]);
      setSettings(s);
      setUsers(u);
      setForm({
        establishmentName: s.establishmentName,
        defaultMaxHoursPerDay: s.defaultMaxHoursPerDay,
        defaultMaxHoursPerWeek: s.defaultMaxHoursPerWeek,
        defaultMaxHoursPerMonth: s.defaultMaxHoursPerMonth,
      });
    } finally { setLoading(false); }
  }, [currentUser?.role]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/plannings/settings', form);
      toast.success('Paramètres enregistrés');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally { setSaving(false); }
  };

  const handleCreateUser = async () => {
    try {
      await api.post('/auth/users', userForm);
      toast.success('Utilisateur créé');
      setUserModal(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (userId === currentUser?.id) { toast.error('Impossible de supprimer votre propre compte'); return; }
    try {
      await api.delete(`/auth/users/${userId}`);
      toast.success('Utilisateur supprimé');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const roleLabels: Record<UserRole, string> = { admin: 'Administrateur', manager: 'Manager', consultation: 'Consultation' };

  if (loading) return <PageLoader />;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-gray-500 mt-1">Configuration de l'établissement</p>
      </div>

      <div className="space-y-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5" /> Établissement
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="label">Nom de l'établissement</label>
              <input className="input" value={form.establishmentName}
                onChange={(e) => setForm({ ...form, establishmentName: e.target.value })} /></div>
            <div><label className="label">Max heures/jour (défaut)</label>
              <input type="number" className="input" value={form.defaultMaxHoursPerDay}
                onChange={(e) => setForm({ ...form, defaultMaxHoursPerDay: parseFloat(e.target.value) })} /></div>
            <div><label className="label">Max heures/semaine (défaut)</label>
              <input type="number" className="input" value={form.defaultMaxHoursPerWeek}
                onChange={(e) => setForm({ ...form, defaultMaxHoursPerWeek: parseFloat(e.target.value) })} /></div>
            <div><label className="label">Max heures/mois (défaut)</label>
              <input type="number" className="input" value={form.defaultMaxHoursPerMonth}
                onChange={(e) => setForm({ ...form, defaultMaxHoursPerMonth: parseFloat(e.target.value) })} /></div>
          </div>
          <div className="flex justify-end mt-6">
            <button onClick={handleSaveSettings} disabled={saving} className="btn-primary">
              <Save className="w-4 h-4" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>

        {currentUser?.role === 'admin' && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="w-5 h-5" /> Utilisateurs
              </h2>
              <button onClick={() => setUserModal(true)} className="btn-primary btn-sm">Ajouter</button>
            </div>
            <div className="space-y-3">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="badge-blue">{roleLabels[u.role]}</span>
                    {u.id !== currentUser.id && (
                      <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:text-red-700 text-sm">Supprimer</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={userModal} onClose={() => setUserModal(false)} title="Nouvel utilisateur" size="sm">
        <div className="space-y-4">
          <div><label className="label">Nom</label>
            <input className="input" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} /></div>
          <div><label className="label">Email</label>
            <input type="email" className="input" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} /></div>
          <div><label className="label">Mot de passe</label>
            <input type="password" className="input" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} /></div>
          <div><label className="label">Rôle</label>
            <select className="input" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as UserRole })}>
              {USER_ROLES.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
            </select></div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setUserModal(false)} className="btn-secondary">Annuler</button>
            <button onClick={handleCreateUser} disabled={!userForm.name || !userForm.email || !userForm.password}
              className="btn-primary">Créer</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
