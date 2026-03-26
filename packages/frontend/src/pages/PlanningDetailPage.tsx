import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Zap, Download, FileSpreadsheet, Send, AlertTriangle,
  UserPlus, Trash2, X, ChevronDown, Pencil, Plus, Settings,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Modal } from '../components/ui/Modal.js';
import { PageLoader } from '../components/ui/LoadingSpinner.js';
import { StarRating } from '../components/ui/StarRating.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { useAuthStore } from '../store/auth.store.js';
import { exportToPdf, exportToExcel } from '../utils/export.js';
import type { PlanningWithDetails, Employee, EmployeeWithDetails, PlanningQualityReport, Assignment, Position, SlotRequirement } from '@planning/shared';
import toast from 'react-hot-toast';

export function PlanningDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [planning, setPlanning] = useState<PlanningWithDetails | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesDetailed, setEmployeesDetailed] = useState<EmployeeWithDetails[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [report, setReport] = useState<PlanningQualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [assignModal, setAssignModal] = useState<number | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'calendar' | 'byEmployee' | 'byPosition'>('calendar');
  const [alertDetail, setAlertDetail] = useState<{ warnings: string[]; x: number; y: number } | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState<'pdf' | 'excel' | null>(null);

  // Edition du planning
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addSlotModalOpen, setAddSlotModalOpen] = useState(false);
  const [deleteReqId, setDeleteReqId] = useState<number | null>(null);
  const [editReqModal, setEditReqModal] = useState<SlotRequirement | null>(null);
  const [editReqForm, setEditReqForm] = useState({ positionId: 0, date: '', startTime: '11:00', endTime: '15:00', headcount: 1 });

  // Ajout en bulk
  const [bulkForm, setBulkForm] = useState({ positionId: 0, startTime: '11:00', endTime: '15:00', headcount: 1, days: [true, true, true, true, true, true, true] as boolean[] });

  const fetchData = useCallback(async () => {
    try {
      const [p, e, ed, pos] = await Promise.all([
        api.get<PlanningWithDetails>(`/plannings/${id}`),
        api.get<Employee[]>('/employees?status=actif'),
        api.get<EmployeeWithDetails[]>('/employees?detailed=true'),
        api.get<Position[]>('/positions'),
      ]);
      setPlanning(p); setEmployees(e); setEmployeesDetailed(ed); setPositions(pos);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const handleClick = () => { setAlertDetail(null); setExportMenuOpen(null); };
    if (alertDetail || exportMenuOpen) document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [alertDetail, exportMenuOpen]);

  const employeeSkillsMap = new Map<number, EmployeeWithDetails>();
  for (const emp of employeesDetailed) employeeSkillsMap.set(emp.id, emp);

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canEdit = isAdmin || isManager;
  const canExportFull = isAdmin || isManager;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await api.post<{ planning: PlanningWithDetails; report: PlanningQualityReport }>(`/plannings/${id}/generate`);
      setPlanning(result.planning); setReport(result.report);
      toast.success('Planning genere - Score : ' + result.report.overallScore.toFixed(0) + '/100');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); }
    finally { setGenerating(false); }
  };

  const handlePublish = async () => {
    try { await api.post(`/plannings/${id}/publish`); toast.success('Planning publie'); fetchData(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); }
  };

  const handleManualAssign = async (slotId: number) => {
    if (!selectedEmployee) return;
    try {
      await api.post(`/plannings/${id}/assignments`, { slotRequirementId: slotId, employeeId: selectedEmployee, force: false });
      toast.success('Affectation ajoutee'); setAssignModal(null); fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (msg.includes('force=true') && confirm(msg + '\n\nForcer ?')) {
        await api.post(`/plannings/${id}/assignments`, { slotRequirementId: slotId, employeeId: selectedEmployee, force: true });
        toast.success('Affectation forcee'); setAssignModal(null); fetchData();
      } else { toast.error(msg); }
    }
  };

  const handleRemoveAssignment = async (assignmentId: number) => {
    try { await api.delete(`/plannings/${id}/assignments/${assignmentId}`); toast.success('Affectation supprimee'); fetchData(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); }
  };

  const showAlertDetail = (warnings: string[], event: React.MouseEvent) => {
    event.stopPropagation(); setAlertDetail({ warnings, x: event.clientX, y: event.clientY });
  };

  const handleExport = (format: 'pdf' | 'excel', full: boolean) => {
    setExportMenuOpen(null);
    if (!planning) return;
    if (format === 'pdf') exportToPdf(planning, full); else exportToExcel(planning, full);
  };

  // --- Edition du planning ---
  const handleDeleteRequirement = async () => {
    if (!deleteReqId) return;
    try {
      await api.delete(`/plannings/${id}/requirements/${deleteReqId}`);
      toast.success('Creneau supprime'); setDeleteReqId(null); fetchData();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); }
  };

  const openEditReq = (req: SlotRequirement) => {
    setEditReqForm({ positionId: req.positionId, date: req.date, startTime: req.startTime, endTime: req.endTime, headcount: req.headcount });
    setEditReqModal(req);
  };

  const handleSaveEditReq = async () => {
    if (!editReqModal) return;
    try {
      await api.put(`/plannings/${id}/requirements/${editReqModal.id}`, editReqForm);
      toast.success('Creneau modifie'); setEditReqModal(null); fetchData();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); }
  };

  const openAddSlot = () => {
    if (positions.length > 0) setBulkForm({ ...bulkForm, positionId: positions[0]!.id });
    setAddSlotModalOpen(true);
  };

  const handleAddSlotsBulk = async () => {
    if (!planning) return;
    const start = new Date(planning.startDate);
    const end = new Date(planning.endDate);
    const requirements: { positionId: number; date: string; startTime: string; endTime: string; headcount: number }[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayIndex = d.getDay();
      const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
      if (bulkForm.days[adjustedIndex]) {
        requirements.push({
          positionId: bulkForm.positionId,
          date: d.toISOString().substring(0, 10),
          startTime: bulkForm.startTime,
          endTime: bulkForm.endTime,
          headcount: bulkForm.headcount,
        });
      }
    }

    if (requirements.length === 0) { toast.error('Aucun creneau genere pour ces jours'); return; }

    try {
      await api.post(`/plannings/${id}/requirements/bulk`, requirements);
      toast.success(requirements.length + ' creneau(x) ajoute(s)'); setAddSlotModalOpen(false); fetchData();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); }
  };

  if (loading || !planning) return <PageLoader />;

  // --- Data grouping ---
  const dateGroups = new Map<string, typeof planning.requirements>();
  for (const req of planning.requirements) {
    if (!dateGroups.has(req.date)) dateGroups.set(req.date, []);
    dateGroups.get(req.date)!.push(req);
  }
  const sortedDates = Array.from(dateGroups.keys()).sort();
  const getAssignmentsForSlot = (slotId: number) => planning.assignments.filter((a) => a.slotRequirementId === slotId);

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

  const renderEmployeeSkills = (employeeId: number) => {
    const emp = employeeSkillsMap.get(employeeId);
    if (!emp || emp.skillRatings.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-0.5">
        {emp.skillRatings.sort((a, b) => b.rating - a.rating).slice(0, 4).map((sr) => (
          <span key={sr.skillId} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600"
            title={(sr.skillName || '') + ' - Niveau ' + sr.rating + '/5'}>
            {(sr.skillName || '').substring(0, 12)}{(sr.skillName || '').length > 12 ? '...' : ''}
            <span className="font-bold text-amber-600">{sr.rating}</span>
          </span>
        ))}
        {emp.skillRatings.length > 4 && <span className="text-[10px] text-gray-400">+{emp.skillRatings.length - 4}</span>}
      </div>
    );
  };

  const renderEmployeeSkillsDetail = (employeeId: number) => {
    const emp = employeeSkillsMap.get(employeeId);
    if (!emp || emp.skillRatings.length === 0) return <p className="text-xs text-gray-400 mt-1">Aucune competence renseignee</p>;
    return (
      <div className="mt-2 space-y-1">
        {emp.skillRatings.sort((a, b) => b.rating - a.rating).map((sr) => (
          <div key={sr.skillId} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1">
            <span className="text-gray-700">{sr.skillName}</span>
            <StarRating value={sr.rating} readonly size="sm" />
          </div>
        ))}
      </div>
    );
  };

  const dayLabels = ['L', 'M', 'Me', 'J', 'V', 'S', 'D'];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/plannings')} className="btn-secondary btn-sm"><ArrowLeft className="w-4 h-4" /></button>
          <div>
            <h1 className="text-2xl font-bold">
              {new Date(planning.startDate).toLocaleDateString('fr-FR')} - {new Date(planning.endDate).toLocaleDateString('fr-FR')}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className={planning.status === 'published' ? 'badge-green' : planning.status === 'generated' ? 'badge-blue' : 'badge-gray'}>
                {planning.status === 'published' ? 'Publie' : planning.status === 'generated' ? 'Genere' : 'Brouillon'}
              </span>
              {planning.qualityScore !== null && <span className="text-sm text-gray-500">Score : {planning.qualityScore.toFixed(0)}/100</span>}
              <span className="text-sm text-gray-400">{planning.requirements.length} creneau(x)</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {canEdit && (
            <button onClick={() => setEditModalOpen(true)} className="btn-secondary">
              <Settings className="w-4 h-4" /> Modifier
            </button>
          )}
          <button onClick={handleGenerate} disabled={generating} className="btn-primary">
            <Zap className="w-4 h-4" /> {generating ? 'Generation...' : 'Generer'}
          </button>
          {planning.status === 'generated' && (
            <button onClick={handlePublish} className="btn-success"><Send className="w-4 h-4" /> Publier</button>
          )}
          {/* PDF */}
          <div className="relative">
            {canExportFull ? (
              <><button onClick={(e) => { e.stopPropagation(); setExportMenuOpen(exportMenuOpen === 'pdf' ? null : 'pdf'); }} className="btn-secondary">
                <Download className="w-4 h-4" /> PDF <ChevronDown className="w-3 h-3" /></button>
                {exportMenuOpen === 'pdf' && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleExport('pdf', false)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 rounded-t-lg">Export simplifie<span className="block text-xs text-gray-400">Sans colonne statut</span></button>
                    <button onClick={() => handleExport('pdf', true)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 rounded-b-lg border-t border-gray-100">Export complet<span className="block text-xs text-gray-400">Avec statut</span></button>
                  </div>)}
              </>
            ) : <button onClick={() => handleExport('pdf', false)} className="btn-secondary"><Download className="w-4 h-4" /> PDF</button>}
          </div>
          {/* Excel */}
          <div className="relative">
            {canExportFull ? (
              <><button onClick={(e) => { e.stopPropagation(); setExportMenuOpen(exportMenuOpen === 'excel' ? null : 'excel'); }} className="btn-secondary">
                <FileSpreadsheet className="w-4 h-4" /> Excel <ChevronDown className="w-3 h-3" /></button>
                {exportMenuOpen === 'excel' && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[220px]" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleExport('excel', false)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 rounded-t-lg">Export simplifie<span className="block text-xs text-gray-400">Sans statut, sans recapitulatif</span></button>
                    <button onClick={() => handleExport('excel', true)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 rounded-b-lg border-t border-gray-100">Export complet<span className="block text-xs text-gray-400">Avec statut et recapitulatif</span></button>
                  </div>)}
              </>
            ) : <button onClick={() => handleExport('excel', false)} className="btn-secondary"><FileSpreadsheet className="w-4 h-4" /> Excel</button>}
          </div>
        </div>
      </div>

      {/* Scores */}
      {planning.qualityScore !== null && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[{ label: 'Score global', value: planning.qualityScore }, { label: 'Couverture', value: planning.coverageScore }, { label: 'Adequation', value: planning.adequacyScore }, { label: 'Equite', value: planning.equityScore }].map((s) => (
            <div key={s.label} className="card p-4 text-center">
              <p className="text-2xl font-bold">{(s.value ?? 0).toFixed(0)}<span className="text-sm text-gray-400">/100</span></p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[{ key: 'calendar', label: 'Calendrier' }, { key: 'byEmployee', label: 'Par employe' }, { key: 'byPosition', label: 'Par poste' }].map((tab) => (
          <button key={tab.key} onClick={() => setViewMode(tab.key as typeof viewMode)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${viewMode === tab.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Alert popover */}
      {alertDetail && (
        <div className="fixed z-50 bg-white border border-amber-200 rounded-lg shadow-xl p-4 max-w-sm"
          style={{ left: Math.min(alertDetail.x, window.innerWidth - 350), top: alertDetail.y + 10 }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /><span className="font-semibold text-sm">Details de l'alerte</span></div>
            <button onClick={() => setAlertDetail(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <ul className="space-y-1">{alertDetail.warnings.map((w, i) => <li key={i} className="text-sm text-gray-700">- {w}</li>)}</ul>
        </div>
      )}

      {/* Vue Calendrier */}
      {viewMode === 'calendar' && (
        <div className="space-y-6">
          {sortedDates.map((date) => {
            const dayName = new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            const slots = dateGroups.get(date) || [];
            return (
              <div key={date} className="card overflow-hidden">
                <div className="bg-gray-50 px-5 py-3 border-b border-gray-200"><h3 className="font-semibold capitalize">{dayName}</h3></div>
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
                            <span className="text-sm text-gray-400">{slot.startTime} - {slot.endTime}</span>
                            <span className="text-xs text-gray-300">x{slot.headcount}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs ${isFull ? 'text-emerald-600' : 'text-red-600'}`}>{assigned.length}/{slot.headcount}</span>
                            {canEdit && (
                              <>
                                <button onClick={() => openEditReq(slot)} className="text-gray-400 hover:text-primary-600" title="Modifier ce creneau"><Pencil className="w-3.5 h-3.5" /></button>
                                <button onClick={() => setDeleteReqId(slot.id)} className="text-gray-400 hover:text-red-600" title="Supprimer ce creneau"><Trash2 className="w-3.5 h-3.5" /></button>
                              </>
                            )}
                            {!isFull && <button onClick={() => { setAssignModal(slot.id); setSelectedEmployee(employees[0]?.id || 0); }} className="btn-secondary btn-sm"><UserPlus className="w-3 h-3" /></button>}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {assigned.map((a) => (
                            <div key={a.id} className={`flex flex-col px-3 py-1.5 rounded-lg text-sm ${a.isForced ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{a.employeeName}</span>
                                {a.isForced && <button onClick={(e) => showAlertDetail(['Affectation forcee manuellement'], e)} className="cursor-pointer" title="Affectation forcee"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /></button>}
                                {!a.isForced && a.warnings.length > 0 && <button onClick={(e) => showAlertDetail(a.warnings, e)} className="cursor-pointer" title={a.warnings.join(' | ')}><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /></button>}
                                <button onClick={() => handleRemoveAssignment(a.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                              </div>
                              {renderEmployeeSkills(a.employeeId)}
                            </div>
                          ))}
                          {!isFull && Array.from({ length: slot.headcount - assigned.length }).map((_, i) => (
                            <div key={`empty-${i}`} className="px-3 py-1.5 rounded-lg text-sm bg-red-50 text-red-400 border border-dashed border-red-200">Non couvert</div>
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

      {/* Vue par employe */}
      {viewMode === 'byEmployee' && (
        <div className="space-y-4">
          {Array.from(employeeAssignments.entries()).map(([empId, assignments]) => {
            const emp = employeeSkillsMap.get(empId);
            const totalHours = assignments.reduce((sum, a) => {
              if (!a.startTime || !a.endTime) return sum;
              const [sh, sm] = a.startTime.split(':').map(Number);
              const [eh, em] = a.endTime.split(':').map(Number);
              return sum + (eh! - sh!) + (em! - sm!) / 60;
            }, 0);
            return (
              <div key={empId} className="card p-5">
                <div className="flex items-center justify-between mb-1"><h3 className="font-semibold">{assignments[0]?.employeeName}</h3><span className="badge-blue">{totalHours.toFixed(1)}h cumulees</span></div>
                {emp && emp.skillRatings.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {emp.skillRatings.sort((a, b) => b.rating - a.rating).map((sr) => (
                      <span key={sr.skillId} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600" title={(sr.skillName || '') + ' - Niveau ' + sr.rating + '/5'}>{sr.skillName} <span className="font-bold text-amber-600">{sr.rating}</span></span>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {assignments.sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((a) => (
                    <div key={a.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.positionColor || '#3B82F6' }} />
                      <span className="text-gray-500">{a.date && new Date(a.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</span>
                      <span>{a.startTime}-{a.endTime}</span><span className="font-medium">{a.positionName}</span>
                      {(a.isForced || a.warnings.length > 0) && <button onClick={(e) => showAlertDetail(a.isForced ? ['Affectation forcee'] : a.warnings, e)} className="cursor-pointer"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /></button>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Vue par poste */}
      {viewMode === 'byPosition' && (
        <div className="space-y-4">
          {Array.from(positionAssignments.entries()).map(([posName, assignments]) => (
            <div key={posName} className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: assignments[0]?.positionColor || '#3B82F6' }} />
                <h3 className="font-semibold">{posName}</h3><span className="badge-gray">{assignments.length} affectations</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {assignments.sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((a) => (
                  <div key={a.id} className="flex flex-col p-2 bg-gray-50 rounded text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{a.date && new Date(a.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</span>
                      <span>{a.startTime}-{a.endTime}</span><span className="font-medium">{a.employeeName}</span>
                      {(a.isForced || a.warnings.length > 0) && <button onClick={(e) => showAlertDetail(a.isForced ? ['Affectation forcee'] : a.warnings, e)} className="cursor-pointer"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /></button>}
                    </div>
                    {renderEmployeeSkills(a.employeeId)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal affectation manuelle */}
      <Modal isOpen={assignModal !== null} onClose={() => setAssignModal(null)} title="Affecter un employe" size="md">
        <div className="space-y-4">
          <div>
            <label className="label">Employe</label>
            <select className="input" value={selectedEmployee} onChange={(e) => setSelectedEmployee(parseInt(e.target.value))}>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </select>
            {selectedEmployee > 0 && renderEmployeeSkillsDetail(selectedEmployee)}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setAssignModal(null)} className="btn-secondary">Annuler</button>
            <button onClick={() => assignModal && handleManualAssign(assignModal)} className="btn-primary">Affecter</button>
          </div>
        </div>
      </Modal>

      {/* Modal modification du planning */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Modifier le planning" size="xl">
        <div className="space-y-6">
          <p className="text-sm text-gray-500">Ajoutez, modifiez ou supprimez des creneaux. Le planning repassera en brouillon apres modification.</p>

          {/* Liste des creneaux existants */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">{planning.requirements.length} creneau(x) existant(s)</h3>
              <button onClick={openAddSlot} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Ajouter des creneaux</button>
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-1">
              {sortedDates.map((date) => {
                const dayName = new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
                const slots = dateGroups.get(date) || [];
                return (
                  <div key={date}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-3 mb-1 capitalize">{dayName}</p>
                    {slots.map((slot) => (
                      <div key={slot.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg mb-1">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: slot.positionColor || '#3B82F6' }} />
                        <span className="text-sm font-medium flex-1">{slot.positionName}</span>
                        <span className="text-sm text-gray-500">{slot.startTime} - {slot.endTime}</span>
                        <span className="text-xs text-gray-400">x{slot.headcount}</span>
                        <button onClick={() => openEditReq(slot)} className="text-primary-600 hover:text-primary-800"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteReqId(slot.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={() => setEditModalOpen(false)} className="btn-secondary">Fermer</button>
          </div>
        </div>
      </Modal>

      {/* Modal ajouter des creneaux en bulk */}
      <Modal isOpen={addSlotModalOpen} onClose={() => setAddSlotModalOpen(false)} title="Ajouter des creneaux" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Ajoutez un poste sur plusieurs jours de la periode ({new Date(planning.startDate).toLocaleDateString('fr-FR')} - {new Date(planning.endDate).toLocaleDateString('fr-FR')})</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Poste</label>
              <select className="input" value={bulkForm.positionId} onChange={(e) => setBulkForm({ ...bulkForm, positionId: parseInt(e.target.value) })}>
                {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Effectif par creneau</label>
              <input type="number" min={1} className="input" value={bulkForm.headcount} onChange={(e) => setBulkForm({ ...bulkForm, headcount: parseInt(e.target.value) || 1 })} />
            </div>
            <div>
              <label className="label">Heure debut</label>
              <input type="time" className="input" value={bulkForm.startTime} onChange={(e) => setBulkForm({ ...bulkForm, startTime: e.target.value })} />
            </div>
            <div>
              <label className="label">Heure fin</label>
              <input type="time" className="input" value={bulkForm.endTime} onChange={(e) => setBulkForm({ ...bulkForm, endTime: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Jours concernes</label>
            <div className="flex gap-2">
              {dayLabels.map((d, j) => (
                <button key={j} type="button" onClick={() => {
                  const days = [...bulkForm.days]; days[j] = !days[j]; setBulkForm({ ...bulkForm, days });
                }} className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${bulkForm.days[j] ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{d}</button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setAddSlotModalOpen(false)} className="btn-secondary">Annuler</button>
            <button onClick={handleAddSlotsBulk} className="btn-primary">Ajouter</button>
          </div>
        </div>
      </Modal>

      {/* Modal modifier un creneau */}
      <Modal isOpen={!!editReqModal} onClose={() => setEditReqModal(null)} title="Modifier le creneau" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Poste</label>
              <select className="input" value={editReqForm.positionId} onChange={(e) => setEditReqForm({ ...editReqForm, positionId: parseInt(e.target.value) })}>
                {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={editReqForm.date} onChange={(e) => setEditReqForm({ ...editReqForm, date: e.target.value })} />
            </div>
            <div>
              <label className="label">Heure debut</label>
              <input type="time" className="input" value={editReqForm.startTime} onChange={(e) => setEditReqForm({ ...editReqForm, startTime: e.target.value })} />
            </div>
            <div>
              <label className="label">Heure fin</label>
              <input type="time" className="input" value={editReqForm.endTime} onChange={(e) => setEditReqForm({ ...editReqForm, endTime: e.target.value })} />
            </div>
            <div>
              <label className="label">Effectif</label>
              <input type="number" min={1} className="input" value={editReqForm.headcount} onChange={(e) => setEditReqForm({ ...editReqForm, headcount: parseInt(e.target.value) || 1 })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setEditReqModal(null)} className="btn-secondary">Annuler</button>
            <button onClick={handleSaveEditReq} className="btn-primary">Enregistrer</button>
          </div>
        </div>
      </Modal>

      {/* Confirmer suppression creneau */}
      <ConfirmDialog isOpen={deleteReqId !== null} onClose={() => setDeleteReqId(null)} onConfirm={handleDeleteRequirement}
        title="Supprimer le creneau" danger
        message="Supprimer ce creneau et toutes les affectations associees ?" confirmText="Supprimer" />
    </div>
  );
}
