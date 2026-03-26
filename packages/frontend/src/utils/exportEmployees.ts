import type { EmployeeWithDetails } from '@planning/shared';

/**
 * Export des employes en PDF.
 * @param employees - Liste des employes
 * @param full - true = complet (avec statut), false = simplifie (sans statut)
 */
export async function exportEmployeesToPdf(employees: EmployeeWithDetails[], full: boolean): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(18);
  doc.text('Liste des employes', 14, 20);
  doc.setFontSize(10);
  doc.text('Exporte le ' + new Date().toLocaleDateString('fr-FR') + ' - ' + employees.length + ' employe(s)', 14, 28);

  const headers = full
    ? ['Nom', 'Email', 'Telephone', 'Contrat', 'Statut', 'Embauche', 'Competences']
    : ['Nom', 'Email', 'Telephone', 'Contrat', 'Embauche', 'Competences'];

  const rows = employees.map((emp) => {
    const skills = emp.skillRatings
      .sort((a, b) => b.rating - a.rating)
      .map((sr) => (sr.skillName || '') + ' (' + sr.rating + ')')
      .join(', ');

    const row: string[] = [
      emp.firstName + ' ' + emp.lastName,
      emp.email,
      emp.phone || '-',
      emp.contractType,
    ];

    if (full) {
      row.push(emp.status === 'actif' ? 'Actif' : 'Inactif');
    }

    row.push(new Date(emp.hireDate).toLocaleDateString('fr-FR'));
    row.push(skills || '-');

    return row;
  });

  autoTable(doc, {
    startY: 34,
    head: [headers],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: full
      ? { 6: { cellWidth: 60 } }
      : { 5: { cellWidth: 60 } },
  });

  const fileName = 'employes-' + new Date().toISOString().substring(0, 10) + (full ? '' : '-simplifie') + '.pdf';
  doc.save(fileName);
}

/**
 * Export des employes en Excel.
 * @param employees - Liste des employes
 * @param full - true = complet (avec statut + recapitulatif), false = simplifie
 */
export async function exportEmployeesToExcel(employees: EmployeeWithDetails[], full: boolean): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Planning RH';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Employes');

  if (full) {
    sheet.columns = [
      { header: 'Prenom', key: 'col_prenom', width: 16 },
      { header: 'Nom', key: 'col_nom', width: 16 },
      { header: 'Email', key: 'col_email', width: 26 },
      { header: 'Telephone', key: 'col_tel', width: 16 },
      { header: 'Contrat', key: 'col_contrat', width: 13 },
      { header: 'Statut', key: 'col_statut', width: 11 },
      { header: 'Embauche', key: 'col_embauche', width: 14 },
      { header: 'Competences', key: 'col_skills', width: 50 },
    ];
  } else {
    sheet.columns = [
      { header: 'Prenom', key: 'col_prenom', width: 16 },
      { header: 'Nom', key: 'col_nom', width: 16 },
      { header: 'Email', key: 'col_email', width: 26 },
      { header: 'Telephone', key: 'col_tel', width: 16 },
      { header: 'Contrat', key: 'col_contrat', width: 13 },
      { header: 'Embauche', key: 'col_embauche', width: 14 },
      { header: 'Competences', key: 'col_skills', width: 50 },
    ];
  }

  // Style en-tete
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
  headerRow.alignment = { horizontal: 'left' };

  for (const emp of employees) {
    const skills = emp.skillRatings
      .sort((a, b) => b.rating - a.rating)
      .map((sr) => (sr.skillName || '') + ' (' + sr.rating + '/5)')
      .join(', ');

    const rowData: Record<string, string> = {
      col_prenom: emp.firstName,
      col_nom: emp.lastName,
      col_email: emp.email,
      col_tel: emp.phone || '',
      col_contrat: emp.contractType,
      col_embauche: new Date(emp.hireDate).toLocaleDateString('fr-FR'),
      col_skills: skills || '-',
    };

    if (full) {
      rowData.col_statut = emp.status === 'actif' ? 'Actif' : 'Inactif';
    }

    sheet.addRow(rowData);
  }

  // Recapitulatif uniquement en mode complet
  if (full) {
    const summarySheet = workbook.addWorksheet('Recapitulatif');
    summarySheet.columns = [
      { header: 'Metrique', key: 'col_metric', width: 26 },
      { header: 'Valeur', key: 'col_value', width: 16 },
    ];
    const sHeader = summarySheet.getRow(1);
    sHeader.font = { bold: true };

    summarySheet.addRow({ col_metric: 'Total employes', col_value: String(employees.length) });
    summarySheet.addRow({ col_metric: 'Actifs', col_value: String(employees.filter((e) => e.status === 'actif').length) });
    summarySheet.addRow({ col_metric: 'Inactifs', col_value: String(employees.filter((e) => e.status === 'inactif').length) });
    summarySheet.addRow({ col_metric: 'CDI', col_value: String(employees.filter((e) => e.contractType === 'CDI').length) });
    summarySheet.addRow({ col_metric: 'CDD', col_value: String(employees.filter((e) => e.contractType === 'CDD').length) });
    summarySheet.addRow({ col_metric: 'Extra', col_value: String(employees.filter((e) => e.contractType === 'Extra').length) });
    summarySheet.addRow({ col_metric: 'Saisonnier', col_value: String(employees.filter((e) => e.contractType === 'Saisonnier').length) });
    summarySheet.addRow({ col_metric: 'Date export', col_value: new Date().toLocaleDateString('fr-FR') });
  }

  // Telecharger
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'employes-' + new Date().toISOString().substring(0, 10) + (full ? '' : '-simplifie') + '.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
