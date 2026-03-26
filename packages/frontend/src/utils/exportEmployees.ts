import type { EmployeeWithDetails } from '@planning/shared';

/**
 * Export des employés en PDF.
 * - Admin : toutes les colonnes (nom, email, téléphone, contrat, statut, embauche, compétences)
 * - Consultation/Manager : pas de colonne "Statut"
 */
export async function exportEmployeesToPdf(employees: EmployeeWithDetails[], isAdmin: boolean): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(18);
  doc.text('Liste des employés', 14, 20);
  doc.setFontSize(10);
  doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')} — ${employees.length} employé(s)`, 14, 28);

  const headers = isAdmin
    ? ['Nom', 'Email', 'Téléphone', 'Contrat', 'Statut', 'Embauche', 'Compétences']
    : ['Nom', 'Email', 'Téléphone', 'Contrat', 'Embauche', 'Compétences'];

  const rows = employees.map((emp) => {
    const skills = emp.skillRatings
      .sort((a, b) => b.rating - a.rating)
      .map((sr) => `${sr.skillName} (${sr.rating})`)
      .join(', ');

    const base = [
      `${emp.firstName} ${emp.lastName}`,
      emp.email,
      emp.phone || '—',
      emp.contractType,
    ];

    if (isAdmin) {
      base.push(emp.status === 'actif' ? 'Actif' : 'Inactif');
    }

    base.push(new Date(emp.hireDate).toLocaleDateString('fr-FR'));
    base.push(skills || '—');

    return base;
  });

  autoTable(doc, {
    startY: 34,
    head: [headers],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: isAdmin
      ? { 6: { cellWidth: 60 } }
      : { 5: { cellWidth: 60 } },
  });

  doc.save(`employes-${new Date().toISOString().substring(0, 10)}.pdf`);
}

/**
 * Export des employés en Excel.
 * - Admin : toutes les colonnes + feuille récapitulatif
 * - Consultation/Manager : pas de colonne "Statut", pas de feuille récapitulatif
 */
export async function exportEmployeesToExcel(employees: EmployeeWithDetails[], isAdmin: boolean): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet('Employés');

  if (isAdmin) {
    sheet.columns = [
      { header: 'Prénom', key: 'firstName', width: 15 },
      { header: 'Nom', key: 'lastName', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Téléphone', key: 'phone', width: 15 },
      { header: 'Contrat', key: 'contract', width: 12 },
      { header: 'Statut', key: 'status', width: 10 },
      { header: 'Embauche', key: 'hireDate', width: 14 },
      { header: 'Compétences', key: 'skills', width: 50 },
    ];
  } else {
    sheet.columns = [
      { header: 'Prénom', key: 'firstName', width: 15 },
      { header: 'Nom', key: 'lastName', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Téléphone', key: 'phone', width: 15 },
      { header: 'Contrat', key: 'contract', width: 12 },
      { header: 'Embauche', key: 'hireDate', width: 14 },
      { header: 'Compétences', key: 'skills', width: 50 },
    ];
  }

  // Style en-tête
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };

  for (const emp of employees) {
    const skills = emp.skillRatings
      .sort((a, b) => b.rating - a.rating)
      .map((sr) => `${sr.skillName} (${sr.rating}/5)`)
      .join(', ');

    const rowData: Record<string, string> = {
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      phone: emp.phone || '',
      contract: emp.contractType,
      hireDate: new Date(emp.hireDate).toLocaleDateString('fr-FR'),
      skills: skills || '—',
    };

    if (isAdmin) {
      rowData.status = emp.status === 'actif' ? 'Actif' : 'Inactif';
    }

    sheet.addRow(rowData);
  }

  // Feuille récapitulatif uniquement pour Admin
  if (isAdmin) {
    const summarySheet = workbook.addWorksheet('Récapitulatif');
    summarySheet.columns = [
      { header: 'Métrique', key: 'metric', width: 25 },
      { header: 'Valeur', key: 'value', width: 15 },
    ];
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.addRow({ metric: 'Total employés', value: employees.length });
    summarySheet.addRow({ metric: 'Actifs', value: employees.filter((e) => e.status === 'actif').length });
    summarySheet.addRow({ metric: 'Inactifs', value: employees.filter((e) => e.status === 'inactif').length });
    summarySheet.addRow({ metric: 'CDI', value: employees.filter((e) => e.contractType === 'CDI').length });
    summarySheet.addRow({ metric: 'CDD', value: employees.filter((e) => e.contractType === 'CDD').length });
    summarySheet.addRow({ metric: 'Extra', value: employees.filter((e) => e.contractType === 'Extra').length });
    summarySheet.addRow({ metric: 'Saisonnier', value: employees.filter((e) => e.contractType === 'Saisonnier').length });
    summarySheet.addRow({ metric: 'Date export', value: new Date().toLocaleDateString('fr-FR') });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `employes-${new Date().toISOString().substring(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
