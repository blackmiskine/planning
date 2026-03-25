import { getDatabase } from '../config/database.js';
import { runMigrations } from '../migrations/run.js';
import { authService } from '../services/auth.service.js';
import { skillService } from '../services/skill.service.js';
import { employeeService } from '../services/employee.service.js';
import { positionService } from '../services/position.service.js';
import { logger } from '../config/logger.js';

function seed() {
  runMigrations();
  const db = getDatabase();

  logger.info('Début du seeding...');

  // Utilisateurs
  authService.ensureAdminExists();
  try {
    authService.createUser({ email: 'manager@planning.local', password: 'manager123', name: 'Marie Dupont', role: 'manager' });
    authService.createUser({ email: 'viewer@planning.local', password: 'viewer123', name: 'Jean Martin', role: 'consultation' });
  } catch { /* déjà existants */ }

  // Compétences
  const skills = [
    { name: 'Service en salle', category: 'salle' as const, description: 'Accueil et service des clients en salle de restaurant' },
    { name: 'Sommellerie', category: 'salle' as const, description: 'Connaissance des vins et conseil client' },
    { name: 'Barista', category: 'salle' as const, description: 'Préparation de cafés et boissons chaudes' },
    { name: 'Cuisine chaude', category: 'cuisine' as const, description: 'Préparation des plats chauds' },
    { name: 'Cuisine froide', category: 'cuisine' as const, description: 'Entrées froides, salades, desserts' },
    { name: 'P\u00e2tisserie', category: 'cuisine' as const, description: 'Préparation des desserts et viennoiseries' },
    { name: 'Réception', category: 'hébergement' as const, description: 'Accueil des clients, check-in/check-out' },
    { name: 'Ménage chambres', category: 'hébergement' as const, description: 'Nettoyage et préparation des chambres' },
    { name: 'Gestion des réservations', category: 'administration' as const, description: 'Gestion du système de réservation' },
    { name: 'Plonge', category: 'polyvalent' as const, description: 'Nettoyage de la vaisselle et des ustensiles' },
  ];

  const skillIds: Record<string, number> = {};
  for (const s of skills) {
    try {
      const created = skillService.create(s);
      skillIds[s.name] = created.id;
    } catch { /* déjà existant */ }
  }

  // Récupérer les IDs si déjà existants
  const allSkills = skillService.getAll();
  for (const s of allSkills) skillIds[s.name] = s.id;

  // Postes
  const positions = [
    { name: 'Chef de rang', color: '#EF4444', defaultHeadcount: 2, skillRequirements: [
      { skillId: skillIds['Service en salle']!, minimumLevel: 4, isRequired: true },
      { skillId: skillIds['Sommellerie']!, minimumLevel: 2, isRequired: true },
      { skillId: skillIds['Barista']!, minimumLevel: 2, isRequired: false },
    ]},
    { name: 'Serveur', color: '#F97316', defaultHeadcount: 3, skillRequirements: [
      { skillId: skillIds['Service en salle']!, minimumLevel: 2, isRequired: true },
    ]},
    { name: 'Chef cuisinier', color: '#8B5CF6', defaultHeadcount: 1, skillRequirements: [
      { skillId: skillIds['Cuisine chaude']!, minimumLevel: 5, isRequired: true },
      { skillId: skillIds['Cuisine froide']!, minimumLevel: 3, isRequired: true },
    ]},
    { name: 'Commis de cuisine', color: '#A855F7', defaultHeadcount: 2, skillRequirements: [
      { skillId: skillIds['Cuisine chaude']!, minimumLevel: 2, isRequired: true },
      { skillId: skillIds['Plonge']!, minimumLevel: 1, isRequired: false },
    ]},
    { name: 'Réceptionniste', color: '#3B82F6', defaultHeadcount: 1, skillRequirements: [
      { skillId: skillIds['R\u00e9ception']!, minimumLevel: 3, isRequired: true },
      { skillId: skillIds['Gestion des r\u00e9servations']!, minimumLevel: 2, isRequired: true },
    ]},
    { name: 'Femme/Valet de chambre', color: '#10B981', defaultHeadcount: 2, skillRequirements: [
      { skillId: skillIds['M\u00e9nage chambres']!, minimumLevel: 2, isRequired: true },
    ]},
  ];

  const positionIds: Record<string, number> = {};
  for (const p of positions) {
    try {
      const created = positionService.create(p);
      positionIds[p.name] = created.id;
    } catch { /* déjà existant */ }
  }
  const allPositions = positionService.getAll();
  for (const p of allPositions) positionIds[p.name] = p.id;

  // Employés
  const employees = [
    { firstName: 'Paul', lastName: 'Bernard', email: 'paul.bernard@hotel.local', hireDate: '2022-03-15', contractType: 'CDI' as const },
    { firstName: 'Julie', lastName: 'Martin', email: 'julie.martin@hotel.local', hireDate: '2021-06-01', contractType: 'CDI' as const },
    { firstName: 'Marc', lastName: 'Dubois', email: 'marc.dubois@hotel.local', hireDate: '2023-01-10', contractType: 'CDD' as const },
    { firstName: 'Sophie', lastName: 'Leroy', email: 'sophie.leroy@hotel.local', hireDate: '2020-09-01', contractType: 'CDI' as const },
    { firstName: 'Thomas', lastName: 'Moreau', email: 'thomas.moreau@hotel.local', hireDate: '2023-05-20', contractType: 'Saisonnier' as const },
    { firstName: 'Camille', lastName: 'Petit', email: 'camille.petit@hotel.local', hireDate: '2022-11-01', contractType: 'CDI' as const },
    { firstName: 'Lucas', lastName: 'Robert', email: 'lucas.robert@hotel.local', hireDate: '2024-01-15', contractType: 'CDD' as const },
    { firstName: 'Emma', lastName: 'Richard', email: 'emma.richard@hotel.local', hireDate: '2021-03-01', contractType: 'CDI' as const },
    { firstName: 'Hugo', lastName: 'Simon', email: 'hugo.simon@hotel.local', hireDate: '2023-07-01', contractType: 'Extra' as const },
    { firstName: 'L\u00e9a', lastName: 'Laurent', email: 'lea.laurent@hotel.local', hireDate: '2022-05-15', contractType: 'CDI' as const },
    { firstName: 'Antoine', lastName: 'Michel', email: 'antoine.michel@hotel.local', hireDate: '2020-01-10', contractType: 'CDI' as const },
    { firstName: 'Clara', lastName: 'Garcia', email: 'clara.garcia@hotel.local', hireDate: '2023-09-01', contractType: 'Saisonnier' as const },
    { firstName: 'Nathan', lastName: 'David', email: 'nathan.david@hotel.local', hireDate: '2024-02-01', contractType: 'CDD' as const },
    { firstName: 'In\u00e8s', lastName: 'Bertrand', email: 'ines.bertrand@hotel.local', hireDate: '2021-11-15', contractType: 'CDI' as const },
    { firstName: 'Maxime', lastName: 'Roux', email: 'maxime.roux@hotel.local', hireDate: '2022-08-01', contractType: 'CDI' as const },
  ];

  const empIds: number[] = [];
  for (const e of employees) {
    try {
      const created = employeeService.create(e);
      empIds.push(created.id);
    } catch { /* déjà existant */ }
  }

  const allEmps = employeeService.getAll();
  const empIdMap: Record<string, number> = {};
  for (const e of allEmps) empIdMap[e.email] = e.id;

  // Affecter des compétences aux employés (données réalistes)
  const empSkills: Record<string, { skillId: number; rating: number }[]> = {
    'paul.bernard@hotel.local': [
      { skillId: skillIds['Service en salle']!, rating: 5 },
      { skillId: skillIds['Sommellerie']!, rating: 3 },
      { skillId: skillIds['Barista']!, rating: 4 },
    ],
    'julie.martin@hotel.local': [
      { skillId: skillIds['Service en salle']!, rating: 4 },
      { skillId: skillIds['Sommellerie']!, rating: 4 },
      { skillId: skillIds['Barista']!, rating: 3 },
    ],
    'marc.dubois@hotel.local': [
      { skillId: skillIds['Service en salle']!, rating: 3 },
      { skillId: skillIds['Sommellerie']!, rating: 5 },
    ],
    'sophie.leroy@hotel.local': [
      { skillId: skillIds['Cuisine chaude']!, rating: 5 },
      { skillId: skillIds['Cuisine froide']!, rating: 4 },
      { skillId: skillIds['P\u00e2tisserie']!, rating: 3 },
    ],
    'thomas.moreau@hotel.local': [
      { skillId: skillIds['Cuisine chaude']!, rating: 3 },
      { skillId: skillIds['Cuisine froide']!, rating: 2 },
      { skillId: skillIds['Plonge']!, rating: 4 },
    ],
    'camille.petit@hotel.local': [
      { skillId: skillIds['Cuisine chaude']!, rating: 4 },
      { skillId: skillIds['P\u00e2tisserie']!, rating: 5 },
      { skillId: skillIds['Cuisine froide']!, rating: 4 },
    ],
    'lucas.robert@hotel.local': [
      { skillId: skillIds['R\u00e9ception']!, rating: 4 },
      { skillId: skillIds['Gestion des r\u00e9servations']!, rating: 3 },
    ],
    'emma.richard@hotel.local': [
      { skillId: skillIds['R\u00e9ception']!, rating: 5 },
      { skillId: skillIds['Gestion des r\u00e9servations']!, rating: 5 },
    ],
    'hugo.simon@hotel.local': [
      { skillId: skillIds['Service en salle']!, rating: 2 },
      { skillId: skillIds['Plonge']!, rating: 3 },
      { skillId: skillIds['M\u00e9nage chambres']!, rating: 2 },
    ],
    'lea.laurent@hotel.local': [
      { skillId: skillIds['M\u00e9nage chambres']!, rating: 4 },
      { skillId: skillIds['Service en salle']!, rating: 2 },
    ],
    'antoine.michel@hotel.local': [
      { skillId: skillIds['Cuisine chaude']!, rating: 5 },
      { skillId: skillIds['Cuisine froide']!, rating: 5 },
      { skillId: skillIds['P\u00e2tisserie']!, rating: 4 },
    ],
    'clara.garcia@hotel.local': [
      { skillId: skillIds['M\u00e9nage chambres']!, rating: 3 },
      { skillId: skillIds['R\u00e9ception']!, rating: 2 },
    ],
    'nathan.david@hotel.local': [
      { skillId: skillIds['Service en salle']!, rating: 3 },
      { skillId: skillIds['Barista']!, rating: 4 },
      { skillId: skillIds['Plonge']!, rating: 2 },
    ],
    'ines.bertrand@hotel.local': [
      { skillId: skillIds['Service en salle']!, rating: 4 },
      { skillId: skillIds['Sommellerie']!, rating: 3 },
      { skillId: skillIds['Cuisine froide']!, rating: 2 },
    ],
    'maxime.roux@hotel.local': [
      { skillId: skillIds['Cuisine chaude']!, rating: 3 },
      { skillId: skillIds['Plonge']!, rating: 5 },
      { skillId: skillIds['M\u00e9nage chambres']!, rating: 3 },
    ],
  };

  for (const [email, ratings] of Object.entries(empSkills)) {
    const empId = empIdMap[email];
    if (empId) {
      try { employeeService.setSkillRatings(empId, ratings); } catch { /* skip */ }
    }
  }

  logger.info('Seeding terminé avec succès');
}

seed();
