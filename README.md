# Planning RH \u2014 H\u00f4tel-Restaurant

Application compl\u00e8te de planification des ressources humaines pour h\u00f4tel-restaurant.  
G\u00e9rez vos employ\u00e9s, comp\u00e9tences, postes et g\u00e9n\u00e9rez des plannings optimis\u00e9s automatiquement.

## Fonctionnalit\u00e9s

### Gestion des comp\u00e9tences
- R\u00e9f\u00e9rentiel de comp\u00e9tences par cat\u00e9gorie (cuisine, salle, h\u00e9bergement, administration, polyvalent)
- CRUD complet avec recherche et filtres

### Profils employ\u00e9s
- Fiches employ\u00e9s compl\u00e8tes (CDI, CDD, Extra, Saisonnier)
- Notes de comp\u00e9tence de 1 \u00e0 5 (D\u00e9butant \u00e0 Expert)
- Pr\u00e9f\u00e9rences de poste class\u00e9es
- Limites horaires personnalis\u00e9es (jour/semaine/mois)

### Gestion des postes
- D\u00e9finition des postes avec couleur et effectif par d\u00e9faut
- Comp\u00e9tences obligatoires et souhait\u00e9es avec niveau minimum

### Disponibilit\u00e9s & contraintes
- Indisponibilit\u00e9s : journ\u00e9e compl\u00e8te, cr\u00e9neau horaire, r\u00e9current
- Limites de temps de travail avec d\u00e9fauts configurables

### G\u00e9n\u00e9ration de planning optimis\u00e9
- Algorithme d'optimisation multi-crit\u00e8res :
  - Ad\u00e9quation comp\u00e9tences/poste (40%)
  - Pr\u00e9f\u00e9rences des employ\u00e9s (25%)
  - \u00c9quit\u00e9 de r\u00e9partition des heures (25%)
  - Comp\u00e9tences bonus (10%)
- Respect strict des contraintes (disponibilit\u00e9s, comp\u00e9tences, heures)
- Score de qualit\u00e9 d\u00e9taill\u00e9 (couverture, ad\u00e9quation, \u00e9quit\u00e9)
- Ajustements manuels avec validation en temps r\u00e9el
- R\u00e9sultats d\u00e9terministes (seed configurable)
- Export PDF et Excel

### Dashboard & vues
- Tableau de bord synth\u00e9tique avec alertes
- Vue calendrier par jour
- Vue par employ\u00e9 (planning personnel, heures cumul\u00e9es)
- Vue par poste

### S\u00e9curit\u00e9
- Authentification JWT
- 3 r\u00f4les : Admin, Manager, Consultation
- Mots de passe hash\u00e9s (bcrypt, 12 rounds)

## Stack technique

| Couche | Technologie |
|--------|------------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Base de donn\u00e9es | SQLite (better-sqlite3) |
| Auth | JWT + bcrypt |
| Export | jsPDF + ExcelJS |
| Desktop | Electron 28 |
| Monorepo | npm workspaces |

## Installation

### Pr\u00e9requis
- Node.js >= 18
- npm >= 9

### Installation

```bash
# Cloner le repo
git clone https://github.com/blackmiskine/planning.git
cd planning

# Installer les d\u00e9pendances
npm install

# Copier la configuration
cp .env.example .env

# Lancer les migrations
npm run migrate

# (Optionnel) Peupler avec des donn\u00e9es de d\u00e9mo
npm run seed

# Lancer en d\u00e9veloppement
npm run dev
```

L'application est accessible sur :
- Frontend : http://localhost:5173
- API : http://localhost:3001/api/v1

### Identifiants par d\u00e9faut

| R\u00f4le | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@planning.local | admin123 |
| Manager | manager@planning.local | manager123 |
| Consultation | viewer@planning.local | viewer123 |

> \u26a0\ufe0f Changez les mots de passe en production !

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
\u251c\u2500\u2500 packages/
\u2502   \u251c\u2500\u2500 shared/          # Types TypeScript + validation Zod
\u2502   \u251c\u2500\u2500 backend/         # API Express + SQLite + Optimiseur
\u2502   \u251c\u2500\u2500 frontend/        # React + Tailwind + Vite
\u2502   \u2514\u2500\u2500 electron/        # Shell Electron pour desktop
\u251c\u2500\u2500 .env.example
\u251c\u2500\u2500 tsconfig.base.json
\u2514\u2500\u2500 package.json         # Workspace root
```

### API REST

| Endpoint | M\u00e9thode | Description |
|----------|---------|-------------|
| `/api/v1/auth/login` | POST | Connexion |
| `/api/v1/auth/me` | GET | Profil courant |
| `/api/v1/auth/users` | GET/POST | Gestion utilisateurs |
| `/api/v1/skills` | GET/POST | Liste/Cr\u00e9er comp\u00e9tences |
| `/api/v1/skills/:id` | GET/PUT/DELETE | CRUD comp\u00e9tence |
| `/api/v1/employees` | GET/POST | Liste/Cr\u00e9er employ\u00e9s |
| `/api/v1/employees/:id` | GET/PUT/DELETE | CRUD employ\u00e9 |
| `/api/v1/employees/:id/skills` | PUT | Notes comp\u00e9tences |
| `/api/v1/employees/:id/preferences` | PUT | Pr\u00e9f\u00e9rences poste |
| `/api/v1/employees/:id/work-limits` | PUT | Limites horaires |
| `/api/v1/employees/:id/unavailabilities` | GET/POST | Indisponibilit\u00e9s |
| `/api/v1/positions` | GET/POST | Liste/Cr\u00e9er postes |
| `/api/v1/positions/:id` | GET/PUT/DELETE | CRUD poste |
| `/api/v1/plannings` | GET/POST | Liste/Cr\u00e9er planning |
| `/api/v1/plannings/:id` | GET/DELETE | D\u00e9tail/Supprimer |
| `/api/v1/plannings/:id/generate` | POST | G\u00e9n\u00e9rer le planning |
| `/api/v1/plannings/:id/publish` | POST | Publier |
| `/api/v1/plannings/:id/assignments` | POST/DELETE | Affectations manuelles |
| `/api/v1/plannings/dashboard` | GET | Statistiques |
| `/api/v1/plannings/settings` | GET/PUT | Param\u00e8tres \u00e9tablissement |

### Algorithme d'optimisation

1. **Filtrage** : \u00e9limine les candidats non \u00e9ligibles (comp\u00e9tences, disponibilit\u00e9s, limites horaires)
2. **Tri par difficult\u00e9** : traite d'abord les cr\u00e9neaux avec le moins de candidats
3. **Scoring pondr\u00e9** par candidat \u00e9ligible :
   - Ad\u00e9quation comp\u00e9tence/poste (40%)
   - Pr\u00e9f\u00e9rence de l'employ\u00e9 (25%)
   - \u00c9quit\u00e9 horaire (25%)
   - Comp\u00e9tences bonus (10%)
4. **Affectation gloutonne** it\u00e9rative avec shuffle d\u00e9terministe

Performance : < 3 secondes pour 50 employ\u00e9s sur 1 semaine.

## Licence

MIT
