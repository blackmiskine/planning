import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Clock, Calendar as CalendarIcon, Star } from 'lucide-react';
import { api } from '../services/api.js';
import { StarRating } from '../components/ui/StarRating.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { PageLoader } from '../components/ui/LoadingSpinner.js';
import { CONTRACT_TYPES, EMPLOYEE_STATUSES } from '@planning/shared';
import type {
  EmployeeWithDetails, Skill, Position, ContractType, EmployeeStatus,
  Unavailability, UnavailabilityType, DayOfWeek,
} from '@planning/shared';
import { DAYS_OF_WEEK } from '@planning/shared';
import toast from 'react-hot-toast';

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<EmployeeWithDetails | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'skills' | 'availability'>('info');

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    hireDate: '', contractType: 'CDI' as ContractType, status: 'actif' as EmployeeStatus,
  });
  const [skillRatings, setSkillRatings] = useState<Record<number, number>>({});
  const [workLimits, setWorkLimits] = useState({ maxHoursPerDay: 10, maxHoursPerWeek: 44, maxHoursPerMonth: 176 });

  const [unavForm, setUnavForm] = useState({
    type: 'full_day' as UnavailabilityType, date: '', startTime: '08:00', endTime: '18:00',
    dayOfWeek: 'lundi' as DayOfWeek, reason: '', isRecurring: false,
  });

  const fetchData = useCallback(async () => {
    try {
      const [emp, sk, pos, unav] = await Promise.all([
        api.get<EmployeeWithDetails>(`/employees/${id}?detailed=true`),
        api.get<Skill[]>('/skills'),
        api.get<Position[]>('/positions'),
        api.get<Unavailability[]>(`/employees/${id}/unavailabilities`),
      ]);
      setEmployee(emp);
      setSkills(sk);
      setPositions(pos);
      setUnavailabilities(unav);
      setForm({
        firstName: emp.firstName, lastName: emp.lastName, email: emp.email,
        phone: emp.phone, hireDate: emp.hireDate, contractType: emp.contractType, status: emp.status,
      });
      const ratings: Record<number, number> = {};
      for (const r of emp.skillRatings) ratings[r.skillId] = r.rating;
      setSkillRatings(ratings);
      if (emp.workLimits) {
        setWorkLimits({
          maxHoursPerDay: emp.workLimits.maxHoursPerDay ?? 10,
          maxHoursPerWeek: emp.workLimits.maxHoursPerWeek ?? 44,
          maxHoursPerMonth: emp.workLimits.maxHoursPerMonth ?? 176,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveInfo = async () => {
    try {
      await api.put(`/employees/${id}`, form);
      toast.success('Informations mises à jour');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const saveSkills = async () => {
    const ratings = Object.entries(skillRatings)
      .filter(([_, v]) => v > 0)
      .map(([skillId, rating]) => ({ skillId: parseInt(skillId), rating }));
    try {
      await api.put(`/employees/${id}/skills`, ratings);
      await api.put(`/employees/${id}/work-limits`, workLimits);
      toast.success('Compétences et limites mises à jour');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const addUnavailability = async () => {
    try {
      await api.post(`/employees/${id}/unavailabilities`, unavForm);
      toast.success('Indisponibilité ajoutée');
      const unav = await api.get<Unavailability[]>(`/employees/${id}/unavailabilities`);
      setUnavailabilities(unav);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const deleteUnavailability = async (unavId: number) => {
    try {
      await api.delete(`/employees/${id}/unavailabilities/${unavId}`);
      setUnavailabilities((prev) => prev.filter((u) => u.id !== unavId));
      toast.success('Indisponibilité supprimée');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/employees/${id}`);
      toast.success('Employé supprimé');
      navigate('/employees');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  if (loading || !employee) return <PageLoader />;

  const tabs = [
    { key: 'info', label: 'Informations', icon: Star },
    { key: 'skills', label: 'Compétences & Limites', icon: Star },
    { key: 'availability', label: 'Disponibilités', icon: CalendarIcon },
  ] as const;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/employees')} className="btn-secondary btn-sm">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{employee.firstName} {employee.lastName}</h1>
            <p className="text-gray-500">{employee.contractType} — {employee.email}</p>
          </div>
        </div>
        <button onClick={() => setDeleteOpen(true)} className="btn-danger btn-sm">
          <Trash2 className="w-4 h-4" /> Supprimer
        </button>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <div className="card p-6">
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
            <div><label className="label">Contrat</label>
              <select className="input" value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value as ContractType })}>
                {CONTRACT_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select></div>
            <div><label className="label">Statut</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as EmployeeStatus })}>
                {EMPLOYEE_STATUSES.map((s) => <option key={s} value={s}>{s === 'actif' ? 'Actif' : 'Inactif'}</option>)}
              </select></div>
          </div>
          <div className="flex justify-end mt-6">
            <button onClick={saveInfo} className="btn-primary"><Save className="w-4 h-4" /> Enregistrer</button>
          </div>
        </div>
      )}

      {activeTab === 'skills' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold mb-4">Notes par compétence</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {skills.map((skill) => (
                <div key={skill.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">{skill.name}</span>
                  <StarRating value={skillRatings[skill.id] || 0}
                    onChange={(v) => setSkillRatings({ ...skillRatings, [skill.id]: v })} />
                </div>
              ))}
            </div>
          </div>
          <div className="card p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Clock className="w-4 h-4" /> Limites horaires</h3>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="label">Max heures/jour</label>
                <input type="number" className="input" value={workLimits.maxHoursPerDay}
                  onChange={(e) => setWorkLimits({ ...workLimits, maxHoursPerDay: parseFloat(e.target.value) })} /></div>
              <div><label className="label">Max heures/semaine</label>
                <input type="number" className="input" value={workLimits.maxHoursPerWeek}
                  onChange={(e) => setWorkLimits({ ...workLimits, maxHoursPerWeek: parseFloat(e.target.value) })} /></div>
              <div><label className="label">Max heures/mois</label>
                <input type="number" className="input" value={workLimits.maxHoursPerMonth}
                  onChange={(e) => setWorkLimits({ ...workLimits, maxHoursPerMonth: parseFloat(e.target.value) })} /></div>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={saveSkills} className="btn-primary"><Save className="w-4 h-4" /> Enregistrer</button>
          </div>
        </div>
      )}

      {activeTab === 'availability' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold mb-4">Ajouter une indisponibilité</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Type</label>
                <select className="input" value={unavForm.type}
                  onChange={(e) => setUnavForm({ ...unavForm, type: e.target.value as UnavailabilityType })}>
                  <option value="full_day">Journée complète</option>
                  <option value="time_slot">Créneau horaire</option>
                  <option value="recurring">Récurrent</option>
                </select></div>
              {unavForm.type !== 'recurring' && (
                <div><label className="label">Date</label>
                  <input type="date" className="input" value={unavForm.date}
                    onChange={(e) => setUnavForm({ ...unavForm, date: e.target.value })} /></div>
              )}
              {unavForm.type === 'recurring' && (
                <div><label className="label">Jour de la semaine</label>
                  <select className="input" value={unavForm.dayOfWeek}
                    onChange={(e) => setUnavForm({ ...unavForm, dayOfWeek: e.target.value as DayOfWeek })}>
                    {DAYS_OF_WEEK.map((d) => <option key={d} value={d} className="capitalize">{d}</option>)}
                  </select></div>
              )}
              {unavForm.type !== 'full_day' && (
                <>
                  <div><label className="label">Heure début</label>
                    <input type="time" className="input" value={unavForm.startTime}
                      onChange={(e) => setUnavForm({ ...unavForm, startTime: e.target.value })} /></div>
                  <div><label className="label">Heure fin</label>
                    <input type="time" className="input" value={unavForm.endTime}
                      onChange={(e) => setUnavForm({ ...unavForm, endTime: e.target.value })} /></div>
                </>
              )}
              <div className="col-span-2"><label className="label">Raison</label>
                <input className="input" value={unavForm.reason}
                  onChange={(e) => setUnavForm({ ...unavForm, reason: e.target.value })} /></div>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={addUnavailability} className="btn-primary">Ajouter</button>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold mb-4">Indisponibilités enregistrées ({unavailabilities.length})</h3>
            {unavailabilities.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune indisponibilité déclarée</p>
            ) : (
              <div className="space-y-2">
                {unavailabilities.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm">
                      <span className="font-medium">
                        {u.type === 'full_day' && `Journée complète — ${u.date}`}
                        {u.type === 'time_slot' && `${u.date} de ${u.startTime} à ${u.endTime}`}
                        {u.type === 'recurring' && `Chaque ${u.dayOfWeek}${u.startTime ? ` de ${u.startTime} à ${u.endTime}` : ''}`}
                      </span>
                      {u.reason && <span className="text-gray-500 ml-2">({u.reason})</span>}
                    </div>
                    <button onClick={() => deleteUnavailability(u.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete}
        title="Supprimer l'employé" danger
        message={`Supprimer ${employee.firstName} ${employee.lastName} ? Toutes ses données seront perdues.`}
        confirmText="Supprimer" />
    </div>
  );
}
