import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Zap, Download, FileSpreadsheet, Send, AlertTriangle,
  UserPlus, Trash2,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Modal } from '../components/ui/Modal.js';
import { PageLoader } from '../components/ui/LoadingSpinner.js';
import { exportToPdf, exportToExcel } from '../utils/export.js';
import type { PlanningWithDetails, Employee, PlanningQualityReport, Assignment } from '@planning/shared';
import toast from 'react-hot-toast';

export function PlanningDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [planning, setPlanning] = useState<PlanningWithDetails | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [report, setReport] = useState<PlanningQualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [assignModal, setAssignModal] = useState<number | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'calendar' | 'byEmployee' | 'byPosition'>('calendar');

  const fetchData = useCallback(async () => {
    try {
      const [p, e] = await Promise.all([
        api.get<PlanningWithDetails>(`/plannings/${id}`),
        api.get<Employee[]>('/employees?status=actif'),
      ]);
      setPlanning(p); setEmployees(e);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await api.post<{ planning: PlanningWithDetails; report: PlanningQualityReport }>(`/plannings/${id}/generate`);
      setPlanning(result.planning);
      setReport(result.report);
      toast.success(`Planning généré — Score : ${result.report.overallScore.toFixed(0)}/100`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally { setGenerating(false); }
  };

  const handlePublish = async () => {
    try {
      await api.post(`/plannings/${id}/publish`);
      toast.success('Planning publié');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleManualAssign = async (slotId: number) => {
    if (!selectedEmployee) return;
    try {
      await api.post(`/plannings/${id}/assignments`, {
        slotRequirementId: slotId, employeeId: selectedEmployee, force: false,
      });
      toast.success('Affectation ajoutée');
      setAssignModal(null);
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (msg.includes('force=true') && confirm(`${msg}\n\nForcer l'affectation ?`)) {
        await api.post(`/plannings/${id}/assignments`, {
          slotRequirementId: slotId, employeeId: selectedEmployee, force: true,
        });
        toast.success('Affectation forcée');
        setAssignModal(null);
        fetchData();
      } else {
        toast.error(msg);
      }
    }
  };

  const handleRemoveAssignment = async (assignmentId: number) => {
    try {
      await api.delete(`/plannings/${id}/assignments/${assignmentId}`);
      toast.success('Affectation supprimée');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  if (loading || !planning) return <PageLoader />;

  const dateGroups = new Map<string, typeof planning.requirements>();
  for (const req of planning.requirements) {
    if (!dateGroups.has(req.date)) dateGroups.set(req.date, []);
    dateGroups.get(req.date)!.push(req);
  }
  const sortedDates = Array.from(dateGroups.keys()).sort();

  const getAssignmentsForSlot = (slotId: number) =>
    planning.assignments.filter((a) => a.slotRequirementId === slotId);

  const employeeAssignments = new Map<number, Assignment[]>();
  for (const a of planning.assignments) {
    if (!employeeAssignments.has(a.employeeId)) employeeAssignments.set(a.employeeId, []);
    employeeAssignments.get(a.employeeId)!.push(a);
  }

  const positionAssignments = new Map<string, Assignment[]>();
  for (const a of planning.assignments) {
    const key = a.positionName || 'Inconnu';
    if (!positionAssignments.has(key)) positionAssignments.set(key, []);
    positionAssignments.get(key)!.push(a);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/plannings')} className="btn-secondary btn-sm">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">
              {new Date(planning.startDate).toLocaleDateString('fr-FR')} — {new Date(planning.endDate).toLocaleDateString('fr-FR')}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className={planning.status === 'published' ? 'badge-green' : planning.status === 'generated' ? 'badge-blue' : 'badge-gray'}>
                {planning.status === 'published' ? 'Publié' : planning.status === 'generated' ? 'Généré' : 'Brouillon'}
              </span>
              {planning.qualityScore !== null && (
                <span className="text-sm text-gray-500">Score : {planning.qualityScore.toFixed(0)}/100</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleGenerate} disabled={generating} className="btn-primary">
            <Zap className="w-4 h-4" /> {generating ? 'Génération...' : 'Générer'}
          </button>
          {planning.status === 'generated' && (
            <button onClick={handlePublish} className="btn-success">
              <Send className="w-4 h-4" /> Publier
            </button>
          )}
          <button onClick={() => planning && exportToPdf(planning)} className="btn-secondary">
            <Download className="w-4 h-4" /> PDF
          </button>
          <button onClick={() => planning && exportToExcel(planning)} className="btn-secondary">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {planning.qualityScore !== null && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Score global', value: planning.qualityScore },
            { label: 'Couverture', value: planning.coverageScore },
            { label: 'Adéquation', value: planning.adequacyScore },
            { label: 'Équité', value: planning.equityScore },
          ].map((s) => (
            <div key={s.label} className="card p-4 text-center">
              <p className="text-2xl font-bold">{(s.value ?? 0).toFixed(0)}<span className="text-sm text-gray-400">/100</span></p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[
          { key: 'calendar', label: 'Calendrier' },
          { key: 'byEmployee', label: 'Par employé' },
          { key: 'byPosition', label: 'Par poste' },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setViewMode(tab.key as typeof viewMode)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              viewMode === tab.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {viewMode === 'calendar' && (
        <div className="space-y-6">
          {sortedDates.map((date) => {
            const dayName = new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            const slots = dateGroups.get(date) || [];
            return (
              <div key={date} className="card overflow-hidden">
                <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                  <h3 className="font-semibold capitalize">{dayName}</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {slots.map((slot) => {
                    const assigned = getAssignmentsForSlot(slot.id);
                    const isFull = assigned.length >= slot.headcount;
                    return (
                      <div key={slot.id} className="px-5 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: slot.positionColor || '#3B82F6' }} />
                            <span className="font-medium">{slot.positionName}</span>
                            <span className="text-sm text-gray-400">{slot.startTime} — {slot.endTime}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs ${isFull ? 'text-emerald-600' : 'text-red-600'}`}>
                              {assigned.length}/{slot.headcount}
                            </span>
                            {!isFull && (
                              <button onClick={() => { setAssignModal(slot.id); setSelectedEmployee(employees[0]?.id || 0); }}
                                className="btn-secondary btn-sm"><UserPlus className="w-3 h-3" /></button>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {assigned.map((a) => (
                            <div key={a.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                              a.isForced ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'
                            }`}>
                              <span>{a.employeeName}</span>
                              {a.isForced && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                              {a.warnings.length > 0 && <AlertTriangle className="w-3 h-3 text-amber-500" title={a.warnings.join(', ')} />}
                              <button onClick={() => handleRemoveAssignment(a.id)} className="text-red-400 hover:text-red-600">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          {!isFull && Array.from({ length: slot.headcount - assigned.length }).map((_, i) => (
                            <div key={`empty-${i}`} className="px-3 py-1.5 rounded-lg text-sm bg-red-50 text-red-400 border border-dashed border-red-200">
                              Non couvert
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'byEmployee' && (
        <div className="space-y-4">
          {Array.from(employeeAssignments.entries()).map(([empId, assignments]) => {
            const totalHours = assignments.reduce((sum, a) => {
              if (!a.startTime || !a.endTime) return sum;
              const [sh, sm] = a.startTime.split(':').map(Number);
              const [eh, em] = a.endTime.split(':').map(Number);
              return sum + (eh! - sh!) + (em! - sm!) / 60;
            }, 0);
            return (
              <div key={empId} className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">{assignments[0]?.employeeName}</h3>
                  <span className="badge-blue">{totalHours.toFixed(1)}h cumulées</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {assignments.sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((a) => (
                    <div key={a.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.positionColor || '#3B82F6' }} />
                      <span className="text-gray-500">{a.date && new Date(a.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</span>
                      <span>{a.startTime}—{a.endTime}</span>
                      <span className="font-medium">{a.positionName}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'byPosition' && (
        <div className="space-y-4">
          {Array.from(positionAssignments.entries()).map(([posName, assignments]) => (
            <div key={posName} className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: assignments[0]?.positionColor || '#3B82F6' }} />
                <h3 className="font-semibold">{posName}</h3>
                <span className="badge-gray">{assignments.length} affectations</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {assignments.sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((a) => (
                  <div key={a.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                    <span className="text-gray-500">{a.date && new Date(a.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</span>
                    <span>{a.startTime}—{a.endTime}</span>
                    <span className="font-medium">{a.employeeName}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={assignModal !== null} onClose={() => setAssignModal(null)} title="Affecter un employé" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Employé</label>
            <select className="input" value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(parseInt(e.target.value))}>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setAssignModal(null)} className="btn-secondary">Annuler</button>
            <button onClick={() => assignModal && handleManualAssign(assignModal)} className="btn-primary">Affecter</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
