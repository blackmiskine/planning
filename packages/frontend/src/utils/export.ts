import type { PlanningWithDetails } from '@planning/shared';

/**
 * Export planning en PDF.
 * @param planning - Le planning avec détails
 * @param full - true = export admin complet, false = export simplifié (sans statut forcé/avertissement, sans scores)
 */
export async function exportToPdf(planning: PlanningWithDetails, full = true): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(18);
  doc.text('Planning RH', 14, 20);
  doc.setFontSize(11);

  const periodText = 'Periode : ' + formatDateFR(planning.startDate) + ' au ' + formatDateFR(planning.endDate);
  doc.text(periodText, 14, 30);

  let startY = 36;

  if (full && planning.qualityScore !== null) {
    doc.setFontSize(10);
    doc.text('Score qualite : ' + planning.qualityScore.toFixed(0) + '/100', 14, 38);
    startY = 44;
  }

  // Construire les données
  const dateGroups = new Map<string, typeof planning.assignments>();
  for (const a of planning.assignments) {
    const date = a.date || '';
    if (!dateGroups.has(date)) dateGroups.set(date, []);
    dateGroups.get(date)!.push(a);
  }

  const sortedDates = Array.from(dateGroups.keys()).sort();

  const headers = full
    ? ['Date', 'Poste', 'Creneau', 'Employe', 'Statut']
    : ['Date', 'Poste', 'Creneau', 'Employe'];

  const rows: string[][] = [];

  for (const date of sortedDates) {
    const dayAssignments = dateGroups.get(date) || [];
    const dayName = formatDayFR(date);

    for (const a of dayAssignments) {
      const row: string[] = [
        dayName,
        a.positionName || '',
        (a.startTime || '') + ' - ' + (a.endTime || ''),
        a.employeeName || '',
      ];
      if (full) {
        let statut = 'OK';
        if (a.isForced) statut = 'Force';
        else if (a.warnings.length > 0) statut = 'Avertissement';
        row.push(statut);
      }
      rows.push(row);
    }
  }

  // Créneaux non couverts
  for (const req of planning.requirements) {
    const assigned = planning.assignments.filter((a) => a.slotRequirementId === req.id);
    const missing = req.headcount - assigned.length;
    if (missing > 0) {
      const dayName = formatDayFR(req.date);
      for (let i = 0; i < missing; i++) {
        const row: string[] = [
          dayName,
          req.positionName || '',
          req.startTime + ' - ' + req.endTime,
          'NON COUVERT',
        ];
        if (full) row.push('ALERTE');
        rows.push(row);
      }
    }
  }

  autoTable(doc, {
    startY,
    head: [headers],
    body: rows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  const fileName = 'planning-' + planning.startDate + '-' + planning.endDate + (full ? '' : '-simplifie') + '.pdf';
  doc.save(fileName);
}

/**
 * Export planning en Excel.
 * @param planning - Le planning avec détails
 * @param full - true = export admin complet (avec statut + récapitulatif), false = simplifié
 */
export async function exportToExcel(planning: PlanningWithDetails, full = true): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Planning RH';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Planning');

  // Définir les colonnes selon le mode
  if (full) {
    sheet.columns = [
      { header: 'Date', key: 'col_date', width: 28 },
      { header: 'Poste', key: 'col_poste', width: 22 },
      { header: 'Creneau', key: 'col_creneau', width: 18 },
      { header: 'Employe', key: 'col_employe', width: 26 },
      { header: 'Statut', key: 'col_statut', width: 16 },
    ];
  } else {
    sheet.columns = [
      { header: 'Date', key: 'col_date', width: 28 },
      { header: 'Poste', key: 'col_poste', width: 22 },
      { header: 'Creneau', key: 'col_creneau', width: 18 },
      { header: 'Employe', key: 'col_employe', width: 26 },
    ];
  }

  // Style en-tete
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
  headerRow.alignment = { horizontal: 'left' };

  // Regrouper par date
  const dateGroups = new Map<string, typeof planning.assignments>();
  for (const a of planning.assignments) {
    const date = a.date || '';
    if (!dateGroups.has(date)) dateGroups.set(date, []);
    dateGroups.get(date)!.push(a);
  }

  const sortedDates = Array.from(dateGroups.keys()).sort();

  for (const date of sortedDates) {
    const dayAssignments = dateGroups.get(date) || [];
    const dayName = formatDayFR(date);

    for (const a of dayAssignments) {
      const rowData: Record<string, string> = {
        col_date: dayName,
        col_poste: a.positionName || '',
        col_creneau: (a.startTime || '') + ' - ' + (a.endTime || ''),
        col_employe: a.employeeName || '',
      };
      if (full) {
        let statut = 'OK';
        if (a.isForced) statut = 'Force';
        else if (a.warnings.length > 0) statut = 'Avertissement';
        rowData.col_statut = statut;
      }
      sheet.addRow(rowData);
    }
  }

  // Non couverts
  for (const req of planning.requirements) {
    const assigned = planning.assignments.filter((a) => a.slotRequirementId === req.id);
    const missing = req.headcount - assigned.length;
    if (missing > 0) {
      const dayName = formatDayFR(req.date);
      for (let i = 0; i < missing; i++) {
        const rowData: Record<string, string> = {
          col_date: dayName,
          col_poste: req.positionName || '',
          col_creneau: req.startTime + ' - ' + req.endTime,
          col_employe: 'NON COUVERT',
        };
        if (full) rowData.col_statut = 'ALERTE';

        const row = sheet.addRow(rowData);
        row.getCell('col_employe').font = { bold: true, color: { argb: 'FFEF4444' } };
        if (full) {
          row.getCell('col_statut').font = { bold: true, color: { argb: 'FFEF4444' } };
        }
      }
    }
  }

  // Feuille recapitulatif uniquement en mode complet
  if (full) {
    const summarySheet = workbook.addWorksheet('Recapitulatif');
    summarySheet.columns = [
      { header: 'Metrique', key: 'col_metric', width: 28 },
      { header: 'Valeur', key: 'col_value', width: 18 },
    ];
    const summaryHeader = summarySheet.getRow(1);
    summaryHeader.font = { bold: true };

    const totalSlots = planning.requirements.reduce((s, r) => s + r.headcount, 0);

    summarySheet.addRow({ col_metric: 'Periode', col_value: planning.startDate + ' au ' + planning.endDate });
    summarySheet.addRow({ col_metric: 'Score global', col_value: planning.qualityScore != null ? planning.qualityScore.toFixed(0) + '/100' : 'N/A' });
    summarySheet.addRow({ col_metric: 'Couverture', col_value: planning.coverageScore != null ? planning.coverageScore.toFixed(0) + '/100' : 'N/A' });
    summarySheet.addRow({ col_metric: 'Adequation', col_value: planning.adequacyScore != null ? planning.adequacyScore.toFixed(0) + '/100' : 'N/A' });
    summarySheet.addRow({ col_metric: 'Equite', col_value: planning.equityScore != null ? planning.equityScore.toFixed(0) + '/100' : 'N/A' });
    summarySheet.addRow({ col_metric: 'Affectations totales', col_value: String(planning.assignments.length) });
    summarySheet.addRow({ col_metric: 'Creneaux requis', col_value: String(totalSlots) });
  }

  // Telecharger
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'planning-' + planning.startDate + '-' + planning.endDate + (full ? '' : '-simplifie') + '.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// --- Helpers ---

function formatDateFR(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return day + '/' + month + '/' + year;
}

const joursSemaine = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const moisNoms = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

function formatDayFR(dateStr: string): string {
  const d = new Date(dateStr);
  const jour = joursSemaine[d.getDay()] || '';
  const num = d.getDate();
  const mois = moisNoms[d.getMonth()] || '';
  return jour + ' ' + num + ' ' + mois;
}
