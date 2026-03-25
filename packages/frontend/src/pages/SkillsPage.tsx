import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Star, Search } from 'lucide-react';
import { api } from '../services/api.js';
import { Modal } from '../components/ui/Modal.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { PageLoader } from '../components/ui/LoadingSpinner.js';
import { SKILL_CATEGORIES } from '@planning/shared';
import type { Skill, SkillCategory } from '@planning/shared';
import toast from 'react-hot-toast';

const categoryLabels: Record<SkillCategory, string> = {
  cuisine: 'Cuisine', salle: 'Salle', hébergement: 'Hébergement',
  administration: 'Administration', polyvalent: 'Polyvalent',
};

const categoryColors: Record<SkillCategory, string> = {
  cuisine: 'badge-purple', salle: 'badge-blue', hébergement: 'badge-green',
  administration: 'badge-yellow', polyvalent: 'badge-gray',
};

export function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<SkillCategory | ''>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editSkill, setEditSkill] = useState<Skill | null>(null);
  const [deleteSkill, setDeleteSkill] = useState<Skill | null>(null);
  const [form, setForm] = useState({ name: '', description: '', category: 'salle' as SkillCategory });
  const [saving, setSaving] = useState(false);

  const fetchSkills = useCallback(async () => {
    try {
      const data = await api.get<Skill[]>('/skills');
      setSkills(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const openCreate = () => {
    setEditSkill(null);
    setForm({ name: '', description: '', category: 'salle' });
    setModalOpen(true);
  };

  const openEdit = (skill: Skill) => {
    setEditSkill(skill);
    setForm({ name: skill.name, description: skill.description, category: skill.category });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editSkill) {
        await api.put(`/skills/${editSkill.id}`, form);
        toast.success('Compétence modifiée');
      } else {
        await api.post('/skills', form);
        toast.success('Compétence créée');
      }
      setModalOpen(false);
      fetchSkills();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteSkill) return;
    try {
      await api.delete(`/skills/${deleteSkill.id}`);
      toast.success('Compétence supprimée');
      fetchSkills();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const filtered = skills.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat && s.category !== filterCat) return false;
    return true;
  });

  if (loading) return <PageLoader />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compétences</h1>
          <p className="text-gray-500 mt-1">Référentiel des compétences de l'établissement</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> Ajouter</button>
      </div>

      <div className="card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Rechercher..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="input pl-10" />
          </div>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value as SkillCategory | '')}
            className="input w-auto">
            <option value="">Toutes les catégories</option>
            {SKILL_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabels[c]}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Star} title="Aucune compétence" description="Commencez par ajouter des compétences au référentiel."
          action={{ label: 'Ajouter une compétence', onClick: openCreate }} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((skill) => (
            <div key={skill.id} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{skill.name}</h3>
                <span className={categoryColors[skill.category]}>{categoryLabels[skill.category]}</span>
              </div>
              {skill.description && <p className="text-sm text-gray-500 mb-3">{skill.description}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={() => openEdit(skill)} className="btn-secondary btn-sm">
                  <Pencil className="w-3.5 h-3.5" /> Modifier
                </button>
                <button onClick={() => setDeleteSkill(skill)} className="btn-danger btn-sm">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editSkill ? 'Modifier la compétence' : 'Nouvelle compétence'}>
        <div className="space-y-4">
          <div>
            <label className="label">Nom</label>
            <input type="text" className="input" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Catégorie</label>
            <select className="input" value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as SkillCategory })}>
              {SKILL_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabels[c]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Description (optionnelle)</label>
            <textarea className="input" rows={3} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Annuler</button>
            <button onClick={handleSave} disabled={saving || !form.name} className="btn-primary">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteSkill} onClose={() => setDeleteSkill(null)}
        onConfirm={handleDelete} title="Supprimer la compétence" danger
        message={`Êtes-vous sûr de vouloir supprimer "${deleteSkill?.name}" ? Cette action est irréversible.`}
        confirmText="Supprimer" />
    </div>
  );
}
