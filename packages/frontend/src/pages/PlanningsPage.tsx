import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Calendar, Eye, Trash2, Zap, CheckCircle, FileEdit } from 'lucide-react';
import { api } from '../services/api.js';
import { Modal } from '../components/ui/Modal.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { PageLoader } from '../components/ui/LoadingSpinner.js';
import type { Planning, Position } from '@planning/shared';
import toast from 'react-hot-toast';

const statusLabels: Record<string, { label: string; class: string; icon: typeof Calendar }> = {
  draft: { label: 'Brouillon', class: 'badge-gray', icon: FileEdit },
  generated: { label: 'Généré', class: 'badge-blue', icon: Zap },
  published: { label: 'Publié', class: 'badge-green', icon: CheckCircle },
};

export function PlanningsPage() {
  const navigate = useNavigate();
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deletePlanning, setDeletePlanning] = useState<Planning | null>(null);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    startDate: '', endDate: '', seed: 42,
  });
  const [slotDefs, setSlotDefs] = useState<{
    positionId: number; startTime: string; endTime: string; headcount: number;
    days: boolean[];
  }[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [p, pos] = await Promise.all([
        api.get<Planning[]>('/plannings'),
        api.get<Position[]>('/positions'),
      ]);
      setPlannings(p); setPositions(pos);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addSlotDef = () => {
    if (positions.length === 0) { toast.error('Créez d\'abord des postes'); return; }
    setSlotDefs([...slotDefs, {
      positionId: positions[0]!.id, startTime: '11:00', endTime: '15:00', headcount: 1,
      days: [true, true, true, true, true, true, true],
    }]);
  };

  const handleCreate = async () => {
    if (!form.startDate || !form.endDate) { toast.error('Sélectionnez les dates'); return; }
    if (slotDefs.length === 0) { toast.error('Ajoutez au moins un besoin'); return; }

    setCreating(true);
    try {
      const requirements: { positionId: number; date: string; startTime: string; endTime: string; headcount: number }[] = [];
      const start = new Date(form.startDate);
      const end = new Date(form.endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayIndex = d.getDay();
        const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
        const dateStr = d.toISOString().substring(0, 10);

        for (const slot of slotDefs) {
          if (slot.days[adjustedIndex]) {
            requirements.push({
              positionId: slot.positionId,
              date: dateStr,
              startTime: slot.startTime,
              endTime: slot.endTime,
              headcount: slot.headcount,
            });
          }
        }
      }

      if (requirements.length === 0) { toast.error('Aucun créneau généré'); return; }

      const planning = await api.post<{ id: number }>('/plannings', {
        startDate: form.startDate, endDate: form.endDate,
        requirements, seed: form.seed,
      });

      toast.success('Planning créé');
      setModalOpen(false);
      navigate(`/plannings/${planning.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally { setCreating(false); }
  };

  const handleDelete = async () => {
    if (!deletePlanning) return;
    try {
      await api.delete(`/plannings/${deletePlanning.id}`);
      toast.success('Planning supprimé');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const dayLabels = ['L', 'M', 'Me', 'J', 'V', 'S', 'D'];

  if (loading) return <PageLoader />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Plannings</h1>
          <p className="text-gray-500 mt-1">{plannings.length} planning(s)</p>
        </div>
        <button onClick={() => { setSlotDefs([]); setModalOpen(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Nouveau planning
        </button>
      </div>

      {plannings.length === 0 ? (
        <EmptyState icon={Calendar} title="Aucun planning"
          description="Créez votre premier planning pour commencer la planification."
          action={{ label: 'Créer un planning', onClick: () => setModalOpen(true) }} />
      ) : (
        <div className="space-y-4">
          {plannings.map((p) => {
            const status = statusLabels[p.status] || statusLabels.draft!;
            return (
              <div key={p.id} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">
                        {new Date(p.startDate).toLocaleDateString('fr-FR')} — {new Date(p.endDate).toLocaleDateString('fr-FR')}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={status.class}>{status.label}</span>
                        {p.qualityScore !== null && (
                          <span className="text-sm text-gray-500">Score : {p.qualityScore.toFixed(0)}/100</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link to={`/plannings/${p.id}`} className="btn-secondary btn-sm">
                      <Eye className="w-4 h-4" /> Voir
                    </Link>
                    <button onClick={() => setDeletePlanning(p)} className="btn-danger btn-sm">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau planning" size="xl">
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Date de début</label>
              <input type="date" className="input" value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><label className="label">Date de fin</label>
              <input type="date" className="input" value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            <div><label className="label">Seed (reproductibilité)</label>
              <input type="number" className="input" value={form.seed}
                onChange={(e) => setForm({ ...form, seed: parseInt(e.target.value) || 42 })} /></div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Besoins par créneau</label>
              <button onClick={addSlotDef} className="btn-secondary btn-sm"><Plus className="w-3 h-3" /> Ajouter</button>
            </div>
            {slotDefs.map((slot, i) => (
              <div key={i} className="flex items-center gap-3 mb-3 p-3 bg-gray-50 rounded-lg">
                <select className="input w-40" value={slot.positionId}
                  onChange={(e) => { const n = [...slotDefs]; n[i] = { ...slot, positionId: parseInt(e.target.value) }; setSlotDefs(n); }}>
                  {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="time" className="input w-28" value={slot.startTime}
                  onChange={(e) => { const n = [...slotDefs]; n[i] = { ...slot, startTime: e.target.value }; setSlotDefs(n); }} />
                <input type="time" className="input w-28" value={slot.endTime}
                  onChange={(e) => { const n = [...slotDefs]; n[i] = { ...slot, endTime: e.target.value }; setSlotDefs(n); }} />
                <input type="number" min={1} className="input w-16" value={slot.headcount}
                  onChange={(e) => { const n = [...slotDefs]; n[i] = { ...slot, headcount: parseInt(e.target.value) || 1 }; setSlotDefs(n); }} />
                <div className="flex gap-1">
                  {dayLabels.map((d, j) => (
                    <button key={j} type="button" onClick={() => {
                      const n = [...slotDefs]; const days = [...slot.days]; days[j] = !days[j];
                      n[i] = { ...slot, days }; setSlotDefs(n);
                    }} className={`w-7 h-7 rounded text-xs font-medium ${
                      slot.days[j] ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>{d}</button>
                  ))}
                </div>
                <button onClick={() => setSlotDefs(slotDefs.filter((_, j) => j !== i))} className="text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {slotDefs.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Ajoutez des besoins pour le planning</p>}
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Annuler</button>
            <button onClick={handleCreate} disabled={creating} className="btn-primary">
              {creating ? 'Création...' : 'Créer le planning'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deletePlanning} onClose={() => setDeletePlanning(null)} onConfirm={handleDelete}
        title="Supprimer le planning" danger
        message="Supprimer ce planning et toutes ses affectations ?" confirmText="Supprimer" />
    </div>
  );
}
