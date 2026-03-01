/**
 * ============================================================
 *  PATRIMOINE LE GONIDEC — Type Definitions
 *  wealth-tracker/src/types.ts
 * ============================================================
 */

// ─── Enums ────────────────────────────────────────────────────

export type AccountType =
  | "PEA"       // Plan Épargne en Actions
  | "CTO"       // Compte Titres Ordinaire
  | "LIVRET_A"  // Livret A
  | "AV"        // Assurance Vie
  | "PEE"       // Plan Épargne Entreprise
  | "PERCO"     // Plan Épargne Retraite Collectif
  | "PERCOL"    // Plan Épargne Retraite Collectif (Loi Pacte)
  | "CRYPTO";   // Wallet crypto

export type AssetClass =
  | "EQUITIES"        // Actions
  | "BONDS"           // Obligations
  | "MONEY_MARKET"    // Monétaire
  | "REAL_ESTATE"     // Immobilier
  | "CRYPTO"          // Crypto-actifs
  | "CASH"            // Liquidités
  | "MIXED"           // Fonds mixtes / allocation dynamique
  | "UNKNOWN";

export type GeographicZone =
  | "US"              // États-Unis / Amérique du Nord
  | "EUROPE"          // Europe
  | "FRANCE"          // France (sous-ensemble Europe)
  | "EMERGING_ASIA"   // Asie Émergente
  | "JAPAN"           // Japon
  | "GLOBAL"          // Monde entier / non alloué géographiquement
  | "CRYPTO_GLOBAL"   // Crypto (pas de géo)
  | "UNKNOWN";

export type Currency = "EUR" | "USD" | "BTC" | "ETH" | "BNB" | "SOL" | "USDC";

export type ManagementMode = "FREE" | "PILOTED" | "ROBO";

export type RiskLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7; // SRRI

// ─── Core Holding ──────────────────────────────────────────────

/**
 * Represents a single position / holding line inside an account.
 */
export interface Holding {
  id: string;                      // unique slug, e.g. "pea-hermes"
  name: string;                    // Display name
  isin?: string;                   // ISIN code (if available)
  ticker?: string;                 // Ticker symbol (for stocks/crypto)
  assetClass: AssetClass;
  geography: GeographicZone[];     // Can be multi-zone for ETFs

  quantity: number;
  currency: Currency;

  // Valuation
  unitCostPrice?: number;          // Prix de revient unitaire (€)
  currentPrice?: number;           // Cours actuel (€ or native unit)
  currentValue: number;            // Évaluation totale en EUR

  // Performance
  unrealizedPnL?: number;          // +/- value latente en EUR
  unrealizedPnLPercent?: number;   // +/- value latente en %
  fiscalPnL?: number;              // +/- value fiscale estimée (épargne salariale)

  // Performance historique (annualisée)
  perf1y?: number;
  perf5yAnnualized?: number;
  perf5yCumulated?: number;

  riskLevel?: RiskLevel;           // SRRI 1-7

  // Metadata
  lastValuationDate?: string;      // ISO date string
  notes?: string;
}

// ─── Account ──────────────────────────────────────────────────

/**
 * Represents a financial account (envelope).
 */
export interface Account {
  id: string;                      // unique slug, e.g. "boursobank-pea"
  institution: Institution;
  type: AccountType;
  name: string;                    // Display name
  accountNumber?: string;          // Masked or full account number

  managementMode?: ManagementMode;
  managementProfile?: string;      // e.g. "Dynamique"

  // Valuation snapshot
  snapshotDate: string;            // ISO date string
  totalValue: number;              // Total portefeuille (titres + espèces) en EUR
  cashBalance: number;             // Solde espèces en EUR
  securitiesValue: number;         // Évaluation titres en EUR

  // Performance
  unrealizedPnL?: number;
  unrealizedPnLPercent?: number;
  fiscalPnL?: number;
  estimatedNetValue?: number;      // Valeur nette après prélèvements sociaux

  perf2026?: number;
  perfLastMonth?: number;
  perfYesterday?: number;

  // Limits (PEA, Livret A, etc.)
  contributionCeiling?: number;    // Plafond de versement
  totalContributed?: number;       // Cumul des versements

  // Holdings detail
  holdings: Holding[];

  // Opening date
  openedAt?: string;               // ISO date string
}

// ─── Institution ──────────────────────────────────────────────

export interface Institution {
  id: string;                      // e.g. "boursobank"
  name: string;                    // Display name
  type: "BANK" | "BROKER" | "INSURANCE" | "CRYPTO_EXCHANGE" | "EMPLOYEE_SAVINGS";
  country: string;                 // ISO 3166-1 alpha-2, e.g. "FR"
  website?: string;
}

// ─── Portfolio Snapshot ────────────────────────────────────────

/**
 * Top-level object — the full wealth snapshot.
 */
export interface PortfolioSnapshot {
  owner: string;
  snapshotDate: string;            // ISO date string

  accounts: Account[];

  // Computed aggregates (populated by the normalizer)
  summary?: PortfolioSummary;
}

// ─── Aggregates ───────────────────────────────────────────────

export interface PortfolioSummary {
  totalValue: number;
  totalUnrealizedPnL: number;
  totalUnrealizedPnLPercent: number;

  byAccountType: Record<AccountType, number>;
  byAssetClass: AssetClassBreakdown[];
  byGeography: GeographyBreakdown[];
  byInstitution: InstitutionBreakdown[];

  topHoldings: TopHolding[];        // top 5 by value
  worstHoldings: TopHolding[];      // top 5 losses by %
}

export interface AssetClassBreakdown {
  assetClass: AssetClass;
  value: number;
  percent: number;
}

export interface GeographyBreakdown {
  zone: GeographicZone;
  value: number;
  percent: number;
}

export interface InstitutionBreakdown {
  institutionId: string;
  institutionName: string;
  value: number;
  percent: number;
}

export interface TopHolding {
  holdingId: string;
  holdingName: string;
  accountId: string;
  accountType: AccountType;
  value: number;
  unrealizedPnLPercent?: number;
}
