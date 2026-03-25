import type { PlanningWithDetails } from '@planning/shared';

export async function exportToPdf(planning: PlanningWithDetails): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(18);
  doc.text('Planning RH', 14, 20);
  doc.setFontSize(12);
  doc.text(
    `Période : ${new Date(planning.startDate).toLocaleDateString('fr-FR')} au ${new Date(planning.endDate).toLocaleDateString('fr-FR')}`,
    14, 30,
  );

  if (planning.qualityScore !== null) {
    doc.text(`Score qualité : ${planning.qualityScore.toFixed(0)}/100`, 14, 38);
  }

  const dateGroups = new Map<string, typeof planning.assignments>();
  for (const a of planning.assignments) {
    const date = a.date || '';
    if (!dateGroups.has(date)) dateGroups.set(date, []);
    dateGroups.get(date)!.push(a);
  }

  const rows: (string | number)[][] = [];
  const sortedDates = Array.from(dateGroups.keys()).sort();

  for (const date of sortedDates) {
    const dayAssignments = dateGroups.get(date) || [];
    const dayName = new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long',
    });

    for (const a of dayAssignments) {
      rows.push([
        dayName,
        a.positionName || '',
        `${a.startTime || ''} - ${a.endTime || ''}`,
        a.employeeName || '',
        a.isForced ? 'Forcé' : a.warnings.length > 0 ? 'Avertissement' : 'OK',
      ]);
    }
  }

  for (const req of planning.requirements) {
    const assigned = planning.assignments.filter((a) => a.slotRequirementId === req.id);
    const missing = req.headcount - assigned.length;
    if (missing > 0) {
      const dayName = new Date(req.date).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long',
      });
      for (let i = 0; i < missing; i++) {
        rows.push([dayName, req.positionName || '', `${req.startTime} - ${req.endTime}`, 'NON COUVERT', 'ALERTE']);
      }
    }
  }

  autoTable(doc, {
    startY: 45,
    head: [['Date', 'Poste', 'Créneau', 'Employé', 'Statut']],
    body: rows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  doc.save(`planning-${planning.startDate}-${planning.endDate}.pdf`);
}

export async function exportToExcel(planning: PlanningWithDetails): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet('Planning');

  sheet.columns = [
    { header: 'Date', key: 'date', width: 25 },
    { header: 'Poste', key: 'position', width: 20 },
    { header: 'Créneau', key: 'slot', width: 15 },
    { header: 'Employé', key: 'employee', width: 25 },
    { header: 'Statut', key: 'status', width: 15 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };

  const dateGroups = new Map<string, typeof planning.assignments>();
  for (const a of planning.assignments) {
    const date = a.date || '';
    if (!dateGroups.has(date)) dateGroups.set(date, []);
    dateGroups.get(date)!.push(a);
  }

  for (const date of Array.from(dateGroups.keys()).sort()) {
    const dayAssignments = dateGroups.get(date) || [];
    for (const a of dayAssignments) {
      sheet.addRow({
        date: new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
        position: a.positionName || '',
        slot: `${a.startTime || ''} - ${a.endTime || ''}`,
        employee: a.employeeName || '',
        status: a.isForced ? 'Forcé' : a.warnings.length > 0 ? 'Avertissement' : 'OK',
      });
    }
  }

  for (const req of planning.requirements) {
    const assigned = planning.assignments.filter((a) => a.slotRequirementId === req.id);
    const missing = req.headcount - assigned.length;
    if (missing > 0) {
      for (let i = 0; i < missing; i++) {
        const row = sheet.addRow({
          date: new Date(req.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
          position: req.positionName || '',
          slot: `${req.startTime} - ${req.endTime}`,
          employee: 'NON COUVERT',
          status: 'ALERTE',
        });
        row.getCell('employee').font = { bold: true, color: { argb: 'FFEF4444' } };
        row.getCell('status').font = { bold: true, color: { argb: 'FFEF4444' } };
      }
    }
  }

  const summarySheet = workbook.addWorksheet('Récapitulatif');
  summarySheet.columns = [
    { header: 'Métrique', key: 'metric', width: 25 },
    { header: 'Valeur', key: 'value', width: 15 },
  ];
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.addRow({ metric: 'Période', value: `${planning.startDate} au ${planning.endDate}` });
  summarySheet.addRow({ metric: 'Score global', value: planning.qualityScore?.toFixed(0) || 'N/A' });
  summarySheet.addRow({ metric: 'Couverture', value: planning.coverageScore?.toFixed(0) || 'N/A' });
  summarySheet.addRow({ metric: 'Adéquation', value: planning.adequacyScore?.toFixed(0) || 'N/A' });
  summarySheet.addRow({ metric: 'Équité', value: planning.equityScore?.toFixed(0) || 'N/A' });
  summarySheet.addRow({ metric: 'Affectations totales', value: planning.assignments.length });
  summarySheet.addRow({ metric: 'Créneaux requis', value: planning.requirements.reduce((s, r) => s + r.headcount, 0) });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `planning-${planning.startDate}-${planning.endDate}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
