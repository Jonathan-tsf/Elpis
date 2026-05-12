# LifeOS — Domaine Physique : Design Spec

**Date** : 2026-05-11
**Status** : Approved (brainstorming) — ready for implementation planning
**Scope** : Premier MVP du projet de vie "LifeOS". Domaine Physique uniquement (Perfs + Santé + Habitudes + Looksmax). Les autres domaines (Travail, Argent, Relations, Couple, Startups, etc.) seront des sous-projets ultérieurs réutilisant la même fondation technique.

---

## 1. Vision

Une application web gamifiée, single-user (Jonathan uniquement), servant de journal de bord quotidien sur tout ce qui touche au corps : performance sportive, santé/longévité, habitudes physiques, transformation esthétique et looksmax.

L'expérience doit donner la sensation d'un jeu vidéo (stats RPG, progression visible, quêtes, récompenses, streaks, saisons, avatar évolutif), avec un mode de saisie principal **vocal** (l'utilisateur raconte sa journée, l'IA range tout dans les bonnes structures), complété par une saisie manuelle par champ.

Une couche IA (Claude via AWS Bedrock) fournit briefings du matin, coaching conversationnel, analyses profondes périodiques, analyses de photos looksmax, génération automatique des quêtes calibrées sur le niveau de l'utilisateur, et critique sur demande.

### Principes directeurs

- **Single-user, simple** : pas de SaaS public, pas de multi-tenancy complexe. Cognito en place pour la propreté mais un seul user.
- **Tout sur AWS** : Lambda + DynamoDB + S3 + Bedrock + Cognito + Transcribe + Amplify Hosting + CDK.
- **Coût minimal** : exploite les free tiers. Cible ~5-15 €/mo en run continu.
- **Stack standard et portable** : TypeScript bout-en-bout, Hono (backend), Next.js (frontend), schemas Zod partagés.
- **Vocal-first à la saisie** : 5 minutes de monologue → l'IA structure → l'utilisateur valide.
- **Données flexibles** : DynamoDB single-table avec attributs JSON riches là où ça fait sens (photos, daily_log, analyses IA).
- **YAGNI** : pas de microservices, pas de Kafka, pas de Kubernetes. Un monolithe serverless modulaire.

---

## 2. Architecture technique

### 2.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND : Next.js 15 (App Router) + TypeScript + Tailwind │
│  shadcn/ui + Framer Motion                                   │
│  Hébergé sur AWS Amplify Hosting                             │
└───────────────────────┬──────────────────────────────────────┘
                        │ HTTPS / JWT Cognito
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  API : Amazon API Gateway (HTTP API) → Lambdas TypeScript    │
│  Framework : Hono (cold starts ~50-150ms)                    │
└───┬────────────────┬────────────────┬───────────┬───────────┘
    ▼                ▼                ▼           ▼
┌────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────────┐
│DynamoDB│  │ S3 (photos,  │  │  Bedrock   │  │  Transcribe  │
│ single │  │  audio,      │  │  Claude    │  │  (fr-FR,     │
│ table  │  │  rapports)   │  │  4.6/Haiku │  │  vocab custom)│
└────────┘  └──────────────┘  └────────────┘  └──────────────┘
                                                ▲
                                                │
                                    ┌──────────────────┐
                                    │ Cognito User Pool│
                                    └──────────────────┘

  EventBridge (cron) → Lambdas : briefing matin, génération quêtes
  IaC : AWS CDK (TypeScript)
  CI/CD : GitHub Actions → ECR/Lambda upload + Amplify deploy
```

### 2.2 Choix technologiques justifiés

| Composant | Choix | Pourquoi |
|---|---|---|
| Compute backend | Lambda + Hono | Free tier 1M req/mo. Hono = cold starts faibles, TS-first. Pas de NestJS (cold starts trop lourds en Lambda). |
| API | API Gateway HTTP API | Moins cher que REST API, suffit pour ce besoin. |
| Base de données | DynamoDB single-table | Free tier 25GB permanent. AWS-native, parfait avec Lambda. Le single-user limite la complexité du single-table design. |
| Storage fichiers | S3 + CloudFront signed URLs | Standard. Photos, audio, rapports IA, exports. |
| Auth | Cognito User Pool | Free 10k MAU. Propre dès le départ, évite la dette d'un DIY auth. |
| LLM | Bedrock + Claude Sonnet 4.6 + Haiku 4.5 | Cohérent AWS. Sonnet pour raisonnement/vision, Haiku pour briefings/quêtes courtes. |
| STT | AWS Transcribe (fr-FR + vocab custom) | Native AWS. Vocab pour termes spécifiques (RPE, PR, jawline, skincare…). |
| Frontend | Next.js 15 + Tailwind + shadcn/ui + Framer Motion | Moderne, productif, bonnes anims. |
| State client | TanStack Query (server data) + Zustand (UI state) | Séparation propre. |
| Hosting front | AWS Amplify Hosting | CI build inclus, SSL auto, branch previews, free tier. |
| IaC | AWS CDK (TypeScript) | Même langage que l'app. Versionné. |
| Monorepo | pnpm workspaces | `apps/web`, `apps/api`, `apps/infra`, `packages/shared` (types Zod). |
| CI/CD | GitHub Actions | Standard. Deploy Lambda + Amplify. |

### 2.3 Modules backend (Hono)

```
apps/api/src/
  routes/
    auth.ts          # /me, /logout (Cognito JWT validé en middleware)
    daily-log.ts     # CRUD DailyLog
    workouts.ts      # CRUD Workout, Exercise, Set
    meals.ts         # CRUD Meal
    measurements.ts  # CRUD Measurement
    photos.ts        # presigned upload S3, metadata, tags
    quests.ts        # listing, complétion manuelle
    stats.ts         # lecture stats + XP events
    achievements.ts  # listing débloqués
    seasons.ts       # saison courante, historique
    ai/
      chat.ts        # coach conversationnel (Sonnet + tools)
      briefing.ts    # endpoint déclenché par cron + lecture last
      analysis.ts    # deep analyse à la demande
      photo.ts       # analyse photos looksmax
      voice-journal.ts # pipeline upload audio → Transcribe → parsing
  services/          # logique métier
    xp-engine.ts     # calcul XP / stats à partir d'événements
    quest-generator.ts # appel IA pour générer quêtes
    decay.ts         # logique Tamagotchi sombre
    bedrock-client.ts
    dynamodb-client.ts (avec single-table helpers)
  middlewares/
    auth.ts          # vérification JWT Cognito
    error.ts
  schemas/           # ré-exporte les Zod depuis packages/shared
```

### 2.4 Coût estimé en run continu

| Service | Coût mensuel estimé |
|---|---|
| Lambda + API Gateway | ~0 € (free tier 1M req) |
| DynamoDB | ~0 € (free tier 25GB) |
| S3 + CloudFront | ~1-2 € |
| Cognito | 0 € |
| Bedrock (toutes IA features avec prompt caching) | ~4-8 € |
| Transcribe (5 min/jour) | ~3 € |
| Amplify Hosting | 0 € (free tier) |
| Route53 + ACM | ~1 € |
| **Total estimé** | **~10-15 €/mo** |

---

## 3. Modèle de données

### 3.1 Single-table design DynamoDB

**Table** : `LifeOS`
**Partition Key (PK)** : `USER#<userId>` (en pratique toujours `USER#me`)
**Sort Key (SK)** : préfixe par type d'entité

| Entité | PK | SK | Contenu (extrait) |
|---|---|---|---|
| Profile | `USER#me` | `PROFILE` | nom, objectifs, préférences, ton coach |
| Stats snapshot | `USER#me` | `STATS` | niveau global, niveaux par stat, XP total |
| DailyLog | `USER#me` | `DAY#YYYY-MM-DD` | sommeil, mood, hydratation, skincare AM/PM, audio s3, transcript, drafts IA |
| Meal | `USER#me` | `MEAL#YYYY-MM-DD#HHMMSS` | time slot, description, score qualité, macros optionnels |
| Supplement | `USER#me` | `SUPP#YYYY-MM-DD#name` | nom, dose |
| Workout | `USER#me` | `WORKOUT#YYYY-MM-DD#<uuid>` | type, durée, intensité, RPE global |
| WorkoutExercise | `USER#me` | `WEX#<workoutId>#<idx>` | nom exo, ordre |
| WorkoutSet | `USER#me` | `WSET#<workoutId>#<exoIdx>#<setIdx>` | reps, charge, RPE |
| Measurement | `USER#me` | `MEAS#<metric>#YYYY-MM-DD` | weight / waist / biceps / etc., valeur |
| Photo | `USER#me` | `PHOTO#YYYY-MM-DD#<uuid>` | s3 url, tags[], conditions{}, ai_analysis JSON, notes |
| VoiceRecording | `USER#me` | `VOICE#YYYY-MM-DD#<uuid>` | s3 url, transcript |
| PerfTest | `USER#me` | `PERF#YYYY-MM-DD#<type>` | type (1RM/VO2), valeur |
| BloodTest | `USER#me` | `BLOOD#YYYY-MM-DD#<uuid>` | s3 PDF, valeurs extraites |
| OutfitFit | `USER#me` | `FIT#YYYY-MM-DD#<uuid>` | s3 photo, tags vêtements |
| Quest | `USER#me` | `QUEST#<uuid>` | titre, description, période (daily/weekly/season), récompense XP, condition, statut, échéance |
| Achievement | `USER#me` | `ACH#<code>` | unlocked_at, contexte |
| Streak | `USER#me` | `STREAK#<category>` | current, longest, last_event |
| XPEvent | `USER#me` | `XP#<timestamp>#<uuid>` | source, montant, stat affectée, motif |
| Season | `USER#me` | `SEASON#<id>` | dates, objectif principal, quêtes saison, récompenses |
| AiThread | `USER#me` | `THREAD#<id>` | titre, last_message_at |
| AiMessage | `USER#me` | `MSG#<threadId>#<ts>` | role, content, tool_calls |
| AiBriefing | `USER#me` | `BRIEF#YYYY-MM-DD` | texte généré, model, tokens |
| AiAnalysisReport | `USER#me` | `REPORT#YYYY-MM-DD#<uuid>` | scope, rapport markdown, source data ids |
| AiPhotoAnalysis | `USER#me` | `PHOTOAN#YYYY-MM-DD#<uuid>` | photo ids analysées, rapport |

### 3.2 GSI (Global Secondary Indexes)

- **GSI1** (`gsi1pk`, `gsi1sk`) : requêtes "par période ou tag"
  - Photos par tag : `gsi1pk = TAG#face`, `gsi1sk = YYYY-MM-DD#uuid`
  - Workouts par exercice : `gsi1pk = EXO#<name>`, `gsi1sk = YYYY-MM-DD`
- **GSI2** (`gsi2pk`, `gsi2sk`) : quêtes par statut/échéance
  - `gsi2pk = QUEST_STATUS#active`, `gsi2sk = <due_at>`

### 3.3 Champs JSON flexibles

DynamoDB étant un document store, on stocke en JSON natif :
- `Photo.conditions` : lighting, mirror, distance, hair_state, etc. — libre.
- `Photo.ai_analysis` : structure issue de Claude (ratios mesurés, recommandations).
- `DailyLog.ai_drafts` : ce que l'IA a proposé après parsing vocal (avant validation user).
- `Profile.preferences` : ton coach, opt-ins fonctionnalités IA, etc.
- `Quest.condition` : règle de complétion sérialisée.

Les schemas Zod dans `packages/shared` documentent ces structures et sont la source de vérité pour validation runtime + types TS.

---

## 4. Système de gamification

### 4.1 Les 6 stats

| Stat | Couleur | Nourrie par |
|---|---|---|
| Force | rouge | Workouts (poids levés, PRs), perf tests force |
| Endurance | orange | Cardio, séances longues, pas, VO2 |
| Vitalité | vert | Sommeil, hydratation, qualité repas, suppléments, valeurs bloodtest dans la norme |
| Discipline | bleu | Streaks, quêtes complétées, régularité saisie |
| Apparence | violet | Skincare AM/PM, photos protocolaires, mensurations, fits, hair/dents/posture/voix |
| Esprit | cyan | Mood/focus moyens, weekly checkin, méditation si trackée |

Chaque stat : niveau 1 → 100 avec barre d'XP propre. Niveau global = moyenne pondérée.

### 4.2 XP engine

Service `xp-engine.ts` qui transforme un événement métier en `XPEvent(s)`. Exemples :

| Événement | XP gagné |
|---|---|
| DailyLog complété | +20 Discipline + bonus selon contenu |
| Sommeil ≥ 8h | +30 Vitalité |
| Sommeil ≥ 7h | +15 Vitalité |
| Séance complétée | +40 base + bonus selon volume/RPE |
| PR sur un exercice | +50 Force |
| Photo protocolaire | +15 Apparence |
| Skincare AM/PM complète | +5+5 Apparence |
| Hydratation cible atteinte | +10 Vitalité |
| Quête daily complétée | +XP de la quête (typiquement 15-30) |
| Quête weekly complétée | +XP de la quête (50-100) |
| Quête saison complétée | +XP de la quête (200-500) |
| Streak ×N (par catégorie) | multiplicateur ×1.0 → ×2.0 |

Les `XPEvent` sont **append-only** ; les niveaux dérivent par agrégation. Snapshot `STATS` mis à jour à chaque event (write-through) pour lecture rapide. Recomputable depuis les events si corruption.

### 4.3 Quêtes

- **Daily** (3-5 quêtes actives) : générées chaque matin par cron (Haiku) selon état + objectifs. Expire à minuit.
- **Weekly** (2-3 quêtes) : générées chaque lundi (Haiku). Expire dimanche soir.
- **Saison** (1-2 quêtes majeures) : générées au début de saison (Sonnet) ou choisies à la main avec assistance IA.

Une quête : `{ title, description, period, xp_reward, condition: { type, params }, status, due_at, source: "ai" | "manual" }`.

La **condition** est évaluée côté backend après chaque event pertinent (ex: type=`sleep_hours_gte`, params=`{ hours: 8 }`).

### 4.4 Streaks

Catégories trackées : `sleep_7h_plus`, `skincare_am`, `skincare_pm`, `workout_weekly`, `hydration`, `daily_log`, `weekly_photo`. Chaque streak a `current` et `longest`. Un streak cassé peut être "racheté" 1 fois par saison via quête bonus.

### 4.5 Achievements

Catalogue codé en dur dans `packages/shared/achievements.ts` (~30-50 achievements pour le MVP). Exemples : `FIRST_100KG_DC`, `STREAK_SLEEP_30D`, `FIRST_SEASON_COMPLETE`, `LOOKSMAX_100_PHOTOS`, etc. Détection auto via subscriber sur les XPEvents pertinents.

### 4.6 Saisons

Trimestrielles (3 mois). À la création : 1 objectif principal + 3 quêtes saison + récompenses (titres cosmétiques, bordure avatar). Fin de saison = écran récap + perks permanents.

### 4.7 Tamagotchi sombre (decay)

Si aucune saisie pendant ≥ 3 jours : décroissance visuelle des stats (jauge "respire" plus lentement, vire au gris) — visuel uniquement, pas de perte d'XP. Après 14 jours d'inactivité : avatar passe en mode "dormant" jusqu'au retour. Job EventBridge quotidien évalue.

### 4.8 Avatar

V1 : portrait stylisé (image générée une fois ou photo de toi passée par filtre néon) + bordure cosmétique selon saison + petit indicateur d'humeur. Pas de 3D, pas d'évolution morphologique en MVP — on peut enrichir plus tard.

---

## 5. Intégration IA (Bedrock)

### 5.1 Modèles utilisés

- **Claude Sonnet 4.6** : raisonnement long, vision, conversations coach, deep analyses, génération quêtes saison.
- **Claude Haiku 4.5** : briefings courts, génération quêtes daily/weekly, pré-remplissage.
- **Prompt caching activé** sur system prompts + fiches récurrentes (profil, objectifs, snapshot stats).

### 5.2 Fonctionnalités IA

| Feature | Trigger | Modèle | Mécanisme |
|---|---|---|---|
| Briefing matin | EventBridge cron 7h | Haiku | Récup 7d data → texte court → `AiBriefing` |
| Coach chat | User → page Coach | Sonnet | Tool-use : `get_daily_logs`, `get_workouts`, `get_measurements`, `get_photos`, `get_stats`, `get_quests` |
| Deep analyse | Bouton "Analyse profonde" | Sonnet + extended thinking | Bundle data domaine sur 30-90j → rapport markdown structuré |
| Analyse photos looksmax | Bouton sur set de photos | Sonnet (vision) | 4-5 photos + objectifs + comparaisons historiques → rapport |
| Génération quêtes daily | EventBridge cron 6h | Haiku | État + objectifs + difficulté calibrée → JSON Zod-validé |
| Génération quêtes weekly | EventBridge cron lundi 6h | Haiku | Idem échelle semaine |
| Génération quêtes saison | Endpoint manuel | Sonnet | Idem échelle trimestre |
| Pré-remplissage saisie | Ouverture form soir | Haiku | Patterns → suggestions champs |
| Critique / sparring | Bouton "avis IA" | Sonnet | Item + contexte → avis direct selon ton configuré |

### 5.3 Tools définis (Claude tool-use)

```typescript
const tools = [
  { name: "get_daily_logs", input: { range_days } },
  { name: "get_workouts", input: { range_days } },
  { name: "get_measurements", input: { range_days, metrics? } },
  { name: "get_photos", input: { tags?, range_days } },
  { name: "get_stats", input: {} },
  { name: "get_quests", input: { status? } },
  { name: "get_profile", input: {} },
  // Pour le journal vocal — tools "writers" :
  { name: "log_sleep", input: { duration_min, quality, wake_time? } },
  { name: "log_meal", input: { time_slot, description, score? } },
  { name: "log_workout", input: { type, exercises: [{ name, sets: [{ reps, weight_kg?, rpe? }] }] } },
  { name: "log_hydration", input: { liters } },
  { name: "log_skincare", input: { am, pm, notes? } },
  { name: "log_supplements", input: { items: [{ name, dose }] } },
  { name: "log_mood", input: { mood, energy, focus, notes? } },
  { name: "log_photo_intent", input: { tag, conditions? } },
  { name: "log_measurement", input: { metric, value } },
  { name: "log_perf_test", input: { type, value } },
];
```

### 5.4 Pipeline journal vocal

```
[Frontend] MediaRecorder → blob webm/opus
       │
       ▼ presigned PUT
[S3] lifeos-voice/{userId}/{YYYY-MM-DD}/{uuid}.webm
       │ trigger S3 event
       ▼
[Lambda voice-journal-processor]
       │
       ├─► Transcribe StartTranscriptionJob (fr-FR, vocab custom)
       │     Job émet event EventBridge à completion → 2e Lambda
       │     (DailyLog mis en état "transcribing")
       │
       ├─► [2e Lambda] Transcript récupéré → Bedrock Claude Sonnet 4.6
       │     System prompt : "Tu es un parseur. Voici la journée de l'utilisateur.
       │     Appelle les tools appropriés pour stocker chaque info. Ne logge rien
       │     dont tu n'es pas sûr."
       │     User message : <transcript>
       │
       ├─► Tool calls → écrits comme `ai_drafts` dans DailyLog (pas appliqués directement)
       │
       └─► Polling depuis le frontend (GET /daily-log/{date}/draft-status)
            jusqu'à status="ready". Pas de WebSocket en MVP — l'attente est
            de l'ordre de 30-60s, polling toutes les 2s acceptable.
       
[Frontend] Écran revue
       │ user valide/corrige champ par champ (code couleur confiance)
       ▼
[POST /daily-log/commit-drafts]
       │ écrit définitivement, déclenche XP engine
       ▼
Stats mises à jour + animations
```

Confidence : chaque tool call IA est marqué `confidence: "high" | "medium" | "low"` selon hint que l'IA donne dans son raisonnement. Codé couleur dans l'UI.

### 5.5 Vocab custom Transcribe

Liste fr-FR à constituer : `RPE, PR, jawline, philtrum, mewing, minox, finastéride, skincare, retinol, niacinamide, push, pull, legs, deadlift, soulevé de terre, développé couché, squat, dips, élévations latérales, VO2, jeun intermittent, créatine, ashwagandha…`

---

## 6. UX / Frontend

### 6.1 Direction visuelle

Dark HUD MMO moderne (vibe Linear/Destiny) + accents cyber data-dense sur les écrans de stats détaillés. Police Inter (UI) + JetBrains Mono (data) + Cinzel ponctuel (titres de saison). Néons cyan/violet/orange/vert selon contexte. Animations Framer Motion (XP popping, level up, streak fire, decay).

### 6.2 Navigation principale (sidebar)

```
🏠 Dashboard     – briefing, quêtes du jour, stats résumées, bouton vocal
🎙️ Journal       – saisie vocale + manuelle
📊 Stats         – fiche perso détaillée, radar, trends, drill-down par stat
🏋️ Workouts      – timeline, programmes, PRs, courbes progression par exo
✨ Looksmax      – photos par tag, sets protocolaires, mensurations, analyses
📅 Saison        – objectif, progression, récompenses
🏆 Trophées      – achievements débloqués + à débloquer
💬 Coach         – chat Claude persistant
🔬 Rapports      – deep analyses sauvegardées
⚙️ Réglages
```

### 6.3 Écrans clés

**Dashboard** : header (avatar + lvl + XP global + streak), card "Briefing du matin", quêtes daily cliquables, 6 barres de stats, bouton flottant 🎙️ "Journal du soir".

**Journal vocal** : plein écran, gros bouton mic pulsant, visualizer audio live, écran de revue post-transcription avec champs IA + code couleur confiance + édition inline + "Valider tout" → animation XP.

**Stats** : radar 6 stats, drill-down par stat (graphes 30/90/365j, XPEvents log, achievements liés).

**Looksmax** : grille photos par tag, comparateur de sets (glissière avant/après), bouton "Analyse IA", tracker mensurations.

**Workouts** : timeline, détail exo (reps/charges/RPE/courbe PR), programme actif.

**Saison** : objectif, 3 quêtes saison avec barres, récompenses à débloquer, historique des saisons.

**Coach** : chat classique persistant, threads listés à gauche.

### 6.4 Modes de saisie (coexistent)

| Mode | Cas d'usage |
|---|---|
| Vocal complet | Débrief soir 3-5 min, l'IA range |
| Manuel par champ | Saisie précise d'un truc spécifique |
| Édition d'un draft IA | Revue post-vocal |
| Photo + tag rapide | Upload photo |
| Chat coach (logging conversationnel) | "Note que j'ai fait 30 min de marche" |
| Quick-log boutons (verre d'eau, skincare, supplément) | Actions fréquentes depuis dashboard |

### 6.5 Stack frontend

- **Next.js 15** (App Router, Server Actions pour les mutations simples)
- **TypeScript strict**
- **Tailwind CSS v4** + **shadcn/ui** customisé (palette néon)
- **Framer Motion** (anims XP, level up, decay, streak fire)
- **TanStack Query** (data fetching/cache)
- **Zustand** (state UI local uniquement)
- **Recharts** ou **Visx** (graphes)
- **Zod** (validation, schemas partagés avec back)
- **AWS Amplify Auth** côté client pour Cognito
- **react-mediarecorder** (journal vocal)

---

## 7. Roadmap & phasage

### Phase 0 — Fondations (S1-S2)

- Monorepo pnpm (`apps/web`, `apps/api`, `apps/infra`, `packages/shared`)
- CDK stack : DynamoDB table + GSIs, S3 buckets (photos, voice, reports), Cognito User Pool, secrets, IAM, EventBridge rules placeholders.
- GitHub Actions : build + déploiement Lambda + déploiement Amplify.
- Backend Hono : healthcheck, middleware auth JWT Cognito, structure routes.
- Frontend Next.js : login Cognito, layout sidebar, design tokens, page placeholder par section.

**Livrable** : "ça déploie, je peux me connecter, la coquille est là".

### Phase 1 — MVP utilisable (S3-S5)

- DailyLog manuel complet (sommeil, mood, hydratation, skincare, repas simples).
- Workouts saisie manuelle (exos/sets/RPE).
- Mesures hebdo (poids + mensurations).
- Photos : upload S3 presigné + tags + grille.
- XP engine + 6 stats calculées + affichage barres + radar.
- Dashboard avec quêtes **hardcodées** (pas encore IA).
- Streaks basiques (sleep, skincare AM/PM, daily_log).
- Animations XP basique.

**Livrable** : utilisable en daily driver dès la fin de cette phase.

### Phase 2 — Journal vocal + IA (S6-S8)

- Pipeline complet : upload audio → Transcribe → Claude tool-use → drafts → écran revue.
- Briefing matin (EventBridge cron + Haiku + `AiBriefing`).
- Génération quêtes daily/weekly par IA (cron).
- Coach chat (page dédiée, threads persistants, tool-use lecture).

**Livrable** : la saisie devient vocale, l'IA pilote les quêtes et briefings.

### Phase 3 — Profondeur gamification (S9-S10)

- Achievements catalogue + détection auto + page Trophées.
- Saisons : création, objectifs, quêtes saison (Sonnet), récompenses, écran récap fin de saison.
- Tamagotchi sombre (decay visuel + mode dormant).
- Avatar V1 (portrait stylisé + bordure saison).
- Animations enrichies (level up plein écran, streak fire).

**Livrable** : la couche jeu est complète.

### Phase 4 — Looksmax avancé + Deep analyse (S11-S12)

- Analyse photos Claude vision (ratios, conseils, comparaisons historiques).
- Comparateur sets photos (glissière avant/après).
- Deep analyses sur demande (Sonnet thinking, bouton dans chaque section).
- Rapports sauvegardés et consultables.
- Tracker bloodtest (upload PDF) + perf tests.

**Livrable** : Domaine Physique complet selon le scope défini ici.

### Phase 5+ — Hors scope MVP

- App mobile (Expo, partage `packages/shared`).
- Connecteurs wearables (Apple Health, Garmin).
- Vocal output (TTS Polly ou Nova Sonic pour briefings audio).
- Export/sauvegardes auto.
- **Nouveaux domaines** (Travail, Argent, Relations, Couple, Startups) — chacun un sous-projet réutilisant fondations + extensions schema.

### Estimation effort total MVP (phases 0 → 4)

Avec ~2h/jour de dev en moyenne : **~3 mois** pour le périmètre complet. Utilisable au quotidien dès fin Phase 1 (~5 semaines).

---

## 8. Considérations techniques additionnelles

### 8.1 Sécurité

- Cognito User Pool, MFA optionnel.
- API Gateway authorizer JWT Cognito sur toutes les routes sauf healthcheck.
- IAM least-privilege : chaque Lambda son rôle minimal.
- S3 buckets privés, accès via presigned URLs uniquement.
- Secrets dans AWS Secrets Manager (pas dans le code/env).
- Pas de CORS large : whitelist explicite du domaine Amplify.

### 8.2 Observabilité

- CloudWatch Logs pour toutes les Lambdas.
- CloudWatch Metrics custom : XPEvents/jour, IA token usage, Transcribe usage, erreurs par route.
- AWS Budget alert > 30€/mo (anomaly detector).
- Pas de Sentry/Datadog en MVP (cost). À ajouter si besoin réel.

### 8.3 Backups / récupération

- DynamoDB Point-in-Time Recovery activé (35 jours rolling).
- S3 versioning sur le bucket photos/audio (protection contre suppression accidentelle).
- Export quotidien JSON de la table → S3 archive (Lambda cron).

### 8.4 Performance / coûts à surveiller

- Cold starts Lambda : bundle léger (esbuild, tree-shake aggressivement), pas de dépendances lourdes côté Hono.
- Prompt caching Bedrock **obligatoire** dès qu'on dépasse quelques appels/jour.
- Transcribe : limiter à 5 min/jour par usage (l'app empêche les enregistrements > 10 min).
- DynamoDB on-demand au début, switch provisioned si pattern d'usage stable.

### 8.5 Migration de schéma

DynamoDB n'a pas de schema migration. Stratégie :
- Tous les items portent un champ `version: number`.
- Lecteurs tolèrent les versions antérieures.
- Migration Lambda one-off quand on bump une version (lecture/réécriture batch).

### 8.6 Tests

- Backend : Vitest + tests d'intégration sur DynamoDB Local (Docker) pour l'XP engine, le quest evaluator, le tool-use parser.
- Frontend : Vitest + Playwright pour quelques flux clés (login, journal vocal, validation drafts).
- Pas de coverage cible rigide ; on couvre la logique métier (xp-engine, quest-evaluator, decay), pas le glue code.

---

## 9. Risques & mitigations

| Risque | Impact | Mitigation |
|---|---|---|
| Single-table design DynamoDB mal pensé devient ingérable | Refactor coûteux | Documenter chaque pattern d'accès AVANT de coder. Tests d'intégration sur les accès. |
| Coûts Bedrock dérapent (deep analyses fréquentes) | Facture | Prompt caching, modèle adapté par feature, alerting Budget. |
| Burn-out de saisie quotidienne | Abandon du projet | Journal vocal = clé. Quick-log buttons. Pré-remplissage IA. |
| Cold starts Lambda dégradent UX | Frustration | Hono léger, bundles minimaux. Lambda SnapStart si nécessaire. |
| Sur-scope précoce (vouloir tous les domaines tout de suite) | Rien ne sort | Ce spec est verrouillé sur le Physique. Pas d'extension avant Phase 4 complète. |
| Bedrock indispo / qualité variable | Features IA HS | Fallback gracieux : l'app reste utilisable sans IA (saisie manuelle, quêtes hardcodées). |

---

## 10. Définition de "fini" (Phase 4)

Le MVP du Domaine Physique est considéré livré quand :

- [ ] Je peux me connecter à l'app depuis un navigateur.
- [ ] Je peux faire un journal vocal de 3 min le soir et obtenir un draft IA cohérent à valider.
- [ ] Tous les types de tracking définis en S2 sont saisissables (manuels + via vocal).
- [ ] Le système d'XP et les 6 stats fonctionnent et reflètent mes actions.
- [ ] Je reçois un briefing du matin pertinent chaque jour.
- [ ] Je peux discuter avec le coach Claude avec accès à mes données.
- [ ] Je peux déclencher une deep analyse sur sommeil / workouts / looksmax / global.
- [ ] Je peux uploader un set de photos protocolaires et obtenir une analyse vision.
- [ ] Les quêtes daily/weekly se génèrent automatiquement chaque cycle.
- [ ] Les saisons fonctionnent (création, suivi, récap fin).
- [ ] L'avatar V1 est affiché et reflète l'état (mode dormant si inactif).
- [ ] L'app est déployée sur AWS et accessible via un domaine custom.
- [ ] Coûts mensuels < 20€ en run normal.
