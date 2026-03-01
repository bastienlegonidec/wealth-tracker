# Wealth Tracker — Patrimoine LE GONIDEC

Agrégateur patrimonial personnel. Next.js 14 + TypeScript + Tailwind + Recharts.

## Structure du projet

```
wealth-tracker/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Redirect → /dashboard
│   │   ├── globals.css             # Global styles + fonts
│   │   ├── dashboard/
│   │   │   ├── page.tsx            # Dashboard principal (Server Component)
│   │   │   └── DashboardCharts.tsx # Recharts wrapper (Client Component)
│   │   ├── accounts/
│   │   │   └── page.tsx            # Liste de tous les comptes
│   │   └── api/
│   │       ├── portfolio/
│   │       │   └── route.ts        # GET /api/portfolio
│   │       └── accounts/
│   │           └── [id]/
│   │               └── route.ts    # GET /api/accounts/:id
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Card.tsx            # Card, CardHeader, CardTitle, CardBadge, CardBody
│   │   │   ├── KpiCard.tsx         # Stat KPI card
│   │   │   ├── SectionTitle.tsx    # Section divider
│   │   │   └── AccountTag.tsx      # Colored account type badge
│   │   ├── charts/
│   │   │   ├── DonutChart.tsx      # Recharts donut + legend
│   │   │   └── HBarChart.tsx       # Horizontal bar chart
│   │   └── layout/
│   │       └── Navbar.tsx          # Navigation bar
│   │
│   ├── lib/
│   │   ├── data.ts                 # Server-side data loader (singleton)
│   │   ├── normalizer.ts           # Portfolio → PortfolioSnapshot + Summary
│   │   └── utils.ts                # formatEUR, pnlColor, labels, colors...
│   │
│   ├── types/
│   │   └── index.ts                # All TypeScript types
│   │
│   └── data/
│       └── portfolio.json          # Source de vérité — snapshot manuel
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── README.md
```

## Installation & démarrage

```bash
npm install
npm run dev
# → http://localhost:3000 (redirige vers /dashboard)
```

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/portfolio` | Portfolio complet avec summary |
| `GET /api/portfolio?view=summary` | Uniquement le PortfolioSummary |
| `GET /api/portfolio?view=accounts` | Comptes sans holdings |
| `GET /api/accounts/all` | Tous les comptes (léger) |
| `GET /api/accounts/:id` | Un compte avec holdings + computed stats |

### Exemples

```bash
# Résumé patrimoine
curl http://localhost:3000/api/portfolio?view=summary

# Détail PEA
curl http://localhost:3000/api/accounts/boursobank-pea

# Wallet Binance
curl http://localhost:3000/api/accounts/binance-wallet

# Amundi PEE Dassault Systèmes
curl http://localhost:3000/api/accounts/amundi-pee-ds
```

## IDs des comptes

| ID | Compte |
|---|---|
| `boursobank-pea` | PEA BoursoBank |
| `boursobank-cto` | CTO BoursoBank |
| `boursobank-livret-a` | Livret A BoursoBank |
| `lcl-av` | Assurance Vie LCL |
| `natixis-perco` | PERCO Natixis |
| `natixis-pee` | PEE Natixis |
| `binance-wallet` | Wallet Binance |
| `amundi-pee-ds` | PEE Amundi (Dassault Systèmes) |
| `amundi-percol-ds` | PER COL Amundi (Dassault Systèmes) |

## Prochaines étapes

1. **Connecteur Binance** — brancher l'API officielle pour les prix live
2. **Connecteur Powens** — Open Banking BoursoBank + LCL
3. **Import CSV Amundi/Natixis** — parser automatique des exports
4. **Historique** — stocker des snapshots en DB (PostgreSQL + Prisma)
5. **Page compte individuelle** — `/accounts/[id]` avec chart évolution
6. **Alertes** — seuils de perte, rééquilibrage
