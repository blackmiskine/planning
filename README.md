# Planning RH — Hôtel-Restaurant

Application complète de planification des ressources humaines pour hôtel-restaurant.
Gérez vos employés, compétences, postes et générez des plannings optimisés automatiquement.

## Fonctionnalités

### Gestion des compétences
- Référentiel de compétences par catégorie (cuisine, salle, hébergement, administration, polyvalent)
- CRUD complet avec recherche et filtres

### Profils employés
- Fiches employés complètes (CDI, CDD, Extra, Saisonnier)
- Notes de compétence de 1 à 5 (Débutant à Expert)
- Préférences de poste classées
- Limites horaires personnalisées (jour/semaine/mois)

### Gestion des postes
- Définition des postes avec couleur et effectif par défaut
- Compétences obligatoires et souhaitées avec niveau minimum

### Disponibilités & contraintes
- Indisponibilités : journée complète, créneau horaire, récurrent
- Limites de temps de travail avec défauts configurables

### Génération de planning optimisé
- Algorithme d'optimisation multi-critères :
  - Adéquation compétences/poste (40%)
  - Préférences des employés (25%)
  - Équité de répartition des heures (25%)
  - Compétences bonus (10%)
- Respect strict des contraintes (disponibilités, compétences, heures)
- Score de qualité détaillé (couverture, adéquation, équité)
- Ajustements manuels avec validation en temps réel
- Résultats déterministes (seed configurable)
- Export PDF et Excel

### Dashboard & vues
- Tableau de bord synthétique avec alertes
- Vue calendrier par jour
- Vue par employé (planning personnel, heures cumulées)
- Vue par poste

### Sécurité
- Authentification JWT
- 3 rôles : Admin, Manager, Consultation
- Mots de passe hashés (bcrypt, 12 rounds)

## Stack technique

| Couche | Technologie |
|--------|------------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Base de données | SQLite (better-sqlite3) |
| Auth | JWT + bcrypt |
| Export | jsPDF + ExcelJS |
| Desktop | Electron 28 |
| Monorepo | npm workspaces |

## Installation

### Prérequis
- Node.js >= 18
- npm >= 9

### Installation

```bash
# Cloner le repo
git clone https://github.com/blackmiskine/planning.git
cd planning

# Installer les dépendances
npm install

# Copier la configuration
cp .env.example .env

# Lancer les migrations
npm run migrate

# (Optionnel) Peupler avec des données de démo
npm run seed

# Lancer en développement
npm run dev
```

L'application est accessible sur :
- Frontend : http://localhost:5173
- API : http://localhost:3001/api/v1

### Identifiants par défaut

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@planning.local | admin123 |
| Manager | manager@planning.local | manager123 |
| Consultation | viewer@planning.local | viewer123 |

> ⚠️ Changez les mots de passe en production !

### Build production

```bash
npm run build
npm start
```

### Build application macOS (Electron)

```bash
npm run build
npm run electron:build
# Le .dmg sera dans /out
```

## Architecture

```
planning/
├── packages/
│   ├── shared/          # Types TypeScript + validation Zod
│   ├── backend/         # API Express + SQLite + Optimiseur
│   ├── frontend/        # React + Tailwind + Vite
│   └── electron/        # Shell Electron pour desktop
├── .env.example
├── tsconfig.base.json
└── package.json         # Workspace root
```

### API REST

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/v1/auth/login` | POST | Connexion |
| `/api/v1/auth/me` | GET | Profil courant |
| `/api/v1/auth/users` | GET/POST | Gestion utilisateurs |
| `/api/v1/skills` | GET/POST | Liste/Créer compétences |
| `/api/v1/skills/:id` | GET/PUT/DELETE | CRUD compétence |
| `/api/v1/employees` | GET/POST | Liste/Créer employés |
| `/api/v1/employees/:id` | GET/PUT/DELETE | CRUD employé |
| `/api/v1/employees/:id/skills` | PUT | Notes compétences |
| `/api/v1/employees/:id/preferences` | PUT | Préférences poste |
| `/api/v1/employees/:id/work-limits` | PUT | Limites horaires |
| `/api/v1/employees/:id/unavailabilities` | GET/POST | Indisponibilités |
| `/api/v1/positions` | GET/POST | Liste/Créer postes |
| `/api/v1/positions/:id` | GET/PUT/DELETE | CRUD poste |
| `/api/v1/plannings` | GET/POST | Liste/Créer planning |
| `/api/v1/plannings/:id` | GET/DELETE | Détail/Supprimer |
| `/api/v1/plannings/:id/generate` | POST | Générer le planning |
| `/api/v1/plannings/:id/publish` | POST | Publier |
| `/api/v1/plannings/:id/assignments` | POST/DELETE | Affectations manuelles |
| `/api/v1/plannings/dashboard` | GET | Statistiques |
| `/api/v1/plannings/settings` | GET/PUT | Paramètres établissement |

### Algorithme d'optimisation

1. **Filtrage** : élimine les candidats non éligibles (compétences, disponibilités, limites horaires)
2. **Tri par difficulté** : traite d'abord les créneaux avec le moins de candidats
3. **Scoring pondéré** par candidat éligible :
   - Adéquation compétence/poste (40%)
   - Préférence de l'employé (25%)
   - Équité horaire (25%)
   - Compétences bonus (10%)
4. **Affectation gloutonne** itérative avec shuffle déterministe

Performance : < 3 secondes pour 50 employés sur 1 semaine.

## Licence

MIT
