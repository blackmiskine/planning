import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Briefcase, Search, Shield, Sparkles } from 'lucide-react';
import { api } from '../services/api.js';
import { Modal } from '../components/ui/Modal.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { PageLoader } from '../components/ui/LoadingSpinner.js';
import type { PositionWithRequirements, Skill } from '@planning/shared';
import toast from 'react-hot-toast';

export function PositionsPage() {
  const [positions, setPositions] = useState<PositionWithRequirements[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editPos, setEditPos] = useState<PositionWithRequirements | null>(null);
  const [deletePos, setDeletePos] = useState<PositionWithRequirements | null>(null);
  const [form, setForm] = useState({ name: '', description: '', color: '#3B82F6', defaultHeadcount: 1 });
  const [reqs, setReqs] = useState<{ skillId: number; minimumLevel: number; isRequired: boolean }[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        api.get<PositionWithRequirements[]>('/positions?detailed=true'),
        api.get<Skill[]>('/skills'),
      ]);
      setPositions(p); setSkills(s);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditPos(null);
    setForm({ name: '', description: '', color: '#3B82F6', defaultHeadcount: 1 });
    setReqs([]);
    setModalOpen(true);
  };

  const openEdit = (pos: PositionWithRequirements) => {
    setEditPos(pos);
    setForm({ name: pos.name, description: pos.description, color: pos.color, defaultHeadcount: pos.defaultHeadcount });
    setReqs(pos.skillRequirements.map((r) => ({ skillId: r.skillId, minimumLevel: r.minimumLevel, isRequired: r.isRequired })));
    setModalOpen(true);
  };

  const addReq = () => {
    const unused = skills.find((s) => !reqs.some((r) => r.skillId === s.id));
    if (unused) setReqs([...reqs, { skillId: unused.id, minimumLevel: 1, isRequired: true }]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = { ...form, skillRequirements: reqs };
      if (editPos) {
        await api.put(`/positions/${editPos.id}`, data);
        toast.success('Poste modifi\u00e9');
      } else {
        await api.post('/positions', data);
        toast.success('Poste cr\u00e9\u00e9');
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletePos) return;
    try {
      await api.delete(`/positions/${deletePos.id}`);
      toast.success('Poste supprim\u00e9');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const filtered = positions.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <PageLoader />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Postes</h1>
          <p className="text-gray-500 mt-1">{positions.length} poste(s) d\u00e9fini(s)</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> Ajouter</button>
      </div>

      <div className="card p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Rechercher..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="input pl-10" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Briefcase} title="Aucun poste" description="D\u00e9finissez les postes de votre \u00e9tablissement."
          action={{ label: 'Ajouter un poste', onClick: openCreate }} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((pos) => (
            <div key={pos.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: pos.color }} />
                <h3 className="font-semibold text-lg">{pos.name}</h3>
                <span className="badge-gray ml-auto">{pos.defaultHeadcount} pers.</span>
              </div>
              {pos.description && <p className="text-sm text-gray-500 mb-3">{pos.description}</p>}
              {pos.skillRequirements.length > 0 && (
                <div className="space-y-1 mb-3">
                  {pos.skillRequirements.map((req) => (
                    <div key={req.id} className="flex items-center gap-2 text-xs">
                      {req.isRequired ? <Shield className="w-3.5 h-3.5 text-red-500" /> : <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                      <span>{req.skillName}</span>
                      <span className="text-gray-400">niv. \u2265 {req.minimumLevel}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => openEdit(pos)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /> Modifier</button>
                <button onClick={() => setDeletePos(pos)} className="btn-danger btn-sm"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editPos ? 'Modifier le poste' : 'Nouveau poste'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Nom</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="flex gap-4">
              <div className="flex-1"><label className="label">Couleur</label>
                <input type="color" className="input h-10" value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
              <div><label className="label">Effectif</label>
                <input type="number" min={1} className="input w-20" value={form.defaultHeadcount}
                  onChange={(e) => setForm({ ...form, defaultHeadcount: parseInt(e.target.value) || 1 })} /></div>
            </div>
          </div>
          <div><label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Comp\u00e9tences requises</label>
              <button type="button" onClick={addReq} className="btn-secondary btn-sm"><Plus className="w-3 h-3" /> Ajouter</button>
            </div>
            {reqs.map((req, i) => (
              <div key={i} className="flex items-center gap-3 mb-2">
                <select className="input flex-1" value={req.skillId}
                  onChange={(e) => { const n = [...reqs]; n[i] = { ...req, skillId: parseInt(e.target.value) }; setReqs(n); }}>
                  {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select className="input w-24" value={req.minimumLevel}
                  onChange={(e) => { const n = [...reqs]; n[i] = { ...req, minimumLevel: parseInt(e.target.value) }; setReqs(n); }}>
                  {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>Niv. {l}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                  <input type="checkbox" checked={req.isRequired}
                    onChange={(e) => { const n = [...reqs]; n[i] = { ...req, isRequired: e.target.checked }; setReqs(n); }}
                    className="rounded" />
                  Obligatoire
                </label>
                <button onClick={() => setReqs(reqs.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Annuler</button>
            <button onClick={handleSave} disabled={saving || !form.name} className="btn-primary">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deletePos} onClose={() => setDeletePos(null)} onConfirm={handleDelete}
        title="Supprimer le poste" danger
        message={`Supprimer le poste "${deletePos?.name}" ? Les affectations existantes seront perdues.`}
        confirmText="Supprimer" />
    </div>
  );
}
