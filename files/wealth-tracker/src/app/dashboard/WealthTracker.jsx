import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, Legend,
} from "recharts"

// ═══════════════════════════════════════════════════════════════════
// DESIGN SYSTEM — Terminal financier phosphore
// ═══════════════════════════════════════════════════════════════════
const C = {
  bg:"#060906", s0:"#0b0f0a", s1:"#0f1410", s2:"#141c12", s3:"#1a2416",
  b0:"#1c2818", b1:"#24341e", b2:"#2e4226",
  acc:"#7dc830", acc2:"#a4e040", acc3:"#c4ff58",
  mut:"#2e4226", mut2:"#4a6238", mut3:"#668050",
  red:"#cc2828", red2:"#ee4444",
  amb:"#c88018", amb2:"#f0a030",
  blu:"#2860b8", blu2:"#4a90e8",
  pur:"#7040b0", tel:"#1a7a60",
  tx:"#c8e4a0", tx2:"#8cb868", tx3:"#567840",
  cMap:{
    PEA:"#7dc830", CTO:"#4a90e8", LIVRET_A:"#1a9870",
    AV:"#c88018", PEE:"#c86028", PERCO:"#9040c0",
    PERCOL:"#d07820", CRYPTO:"#d4c820",
  },
  aMap:{
    EQUITIES:"#7dc830", BONDS:"#c88018", MIXED:"#4a90e8",
    MONEY_MARKET:"#1a9870", CRYPTO:"#d4c820", CASH:"#668050", UNKNOWN:"#2e4226",
  },
  gMap:{
    "États-Unis":"#4a90e8", "Europe":"#7dc830", "France":"#1a9870",
    "Asie émergente":"#c88018", "Japon":"#c86028",
    "Monde diversifié":"#9040c0", "Crypto":"#d4c820", "Non géolocalisé":"#2e4226",
  },
}

const M = {fontFamily:"'Courier New',Courier,monospace"}
const S = {fontFamily:"Georgia,'Times New Roman',serif"}

// ─── ETF geographic weights (real data) ──────────────────────────
const ETF_GEO = {
  "FR0011871128": {US:98,Europe:2},
  "FR0011871110": {US:98,Europe:2},
  "FR001400U5Q4": {US:65,Europe:15,Japon:7,"Asie émergente":5,Monde:8},
  "FR0013412012": {"Asie émergente":78,Monde:15,"Non géolocalisé":7},
  "FR0010833715": {US:40,Europe:45,Monde:15},
}

// Zone name mapping — no more "Other" or "UNKNOWN"
const GEO_NAME = {
  US:"États-Unis", EUROPE:"Europe", FRANCE:"France",
  EMERGING_ASIA:"Asie émergente", JAPAN:"Japon",
  GLOBAL:"Monde diversifié", CRYPTO_GLOBAL:"Crypto (mondial)",
  UNKNOWN:"Non géolocalisé",
}

const ASSET_NAME = {
  EQUITIES:"Actions", BONDS:"Obligataire", MIXED:"Mixte",
  MONEY_MARKET:"Monétaire", CRYPTO:"Crypto-actifs",
  CASH:"Liquidités", UNKNOWN:"Non classifié",
}

const ACC_NAME = {
  PEA:"PEA", CTO:"CTO", LIVRET_A:"Livret A",
  AV:"Assurance Vie", PEE:"PEE", PERCO:"PERCO",
  PERCOL:"PER COL", CRYPTO:"Crypto",
}

const TARGETS = {
  conservateur: {Actions:20,Obligataire:55,Mixte:15,Monétaire:5,"Crypto-actifs":0,Liquidités:5},
  modéré:       {Actions:45,Obligataire:25,Mixte:20,Monétaire:5,"Crypto-actifs":2,Liquidités:3},
  dynamique:    {Actions:65,Obligataire:10,Mixte:15,Monétaire:2,"Crypto-actifs":5,Liquidités:3},
  agressif:     {Actions:75,Obligataire:5, Mixte:5, Monétaire:0,"Crypto-actifs":12,Liquidités:3},
}

// ─── Formatters ────────────────────────────────────────────────────
const f$ = (v, compact=false) => {
  if(v==null||isNaN(v)) return "—"
  if(compact && Math.abs(v)>=1000) {
    const k=v/1000
    return (k%1===0?k.toFixed(0):k.toFixed(1))+"k€"
  }
  return new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",minimumFractionDigits:2}).format(v)
}
const fp = (v,s=true) => v==null||isNaN(v)?"—":`${s&&v>0?"+":""}${v.toFixed(2)}%`
const pc = v => !v||v===0?C.mut3:v>0?C.acc:C.red

// Normalise les clés ETF_GEO (en anglais) vers les mêmes noms français que GEO_NAME
const ETF_ZONE_NAME = {
  US:"États-Unis", Europe:"Europe", Japon:"Japon",
  "Asie émergente":"Asie émergente", Monde:"Monde diversifié",
}

// ─── Geo exposure with real ETF weights ───────────────────────────
function geoExposure(accounts) {
  const m = {}
  const add = (zone, val) => { m[zone] = (m[zone]||0) + val }
  for (const acc of accounts) {
    for (const h of (acc.holdings||[])) {
      const weights = h.isin && ETF_GEO[h.isin]
      if (weights) {
        for (const [z, pct] of Object.entries(weights)) {
          const name = ETF_ZONE_NAME[z] || GEO_NAME[z] || z
          add(name, h.currentValue * pct / 100)
        }
      } else {
        for (const z of (h.geography||["UNKNOWN"])) {
          const name = GEO_NAME[z] || ETF_ZONE_NAME[z] || z
          add(name, h.currentValue / (h.geography?.length||1))
        }
      }
    }
  }
  const tot = Object.values(m).reduce((s,v)=>s+v,0)
  return Object.entries(m)
    .map(([zone,value]) => ({zone,value,percent:tot>0?(value/tot)*100:0}))
    .sort((a,b)=>b.value-a.value)
}

function assetBreakdown(accounts) {
  const m = {}
  for (const acc of accounts)
    for (const h of (acc.holdings||[]))
      m[h.assetClass||"UNKNOWN"] = (m[h.assetClass||"UNKNOWN"]||0) + h.currentValue
  const tot = Object.values(m).reduce((s,v)=>s+v,0)
  return Object.entries(m)
    .map(([cls,value]) => ({cls,label:ASSET_NAME[cls]||cls,value,percent:tot>0?(value/tot)*100:0}))
    .sort((a,b)=>b.value-a.value)
}

// ─── XIRR ─────────────────────────────────────────────────────────
function xirr(cfs) {
  if(!cfs||cfs.length<2) return null
  const t0 = new Date(cfs[0].date).getTime()
  const yrs = cfs.map(cf => (new Date(cf.date).getTime()-t0)/(365.25*864e5))
  const amts = cfs.map(cf => cf.amount)
  const npv = r => amts.reduce((s,a,i) => s+a/Math.pow(1+r,yrs[i]), 0)
  const dnpv = r => amts.reduce((s,a,i) => s-yrs[i]*a/Math.pow(1+r,yrs[i]+1), 0)
  let r = 0.1
  for(let i=0;i<60;i++){
    const n=npv(r),d=dnpv(r)
    if(Math.abs(d)<1e-12) break
    const nr=r-n/d
    if(Math.abs(nr-r)<1e-8){r=nr;break}
    r=Math.max(nr,-0.9)
  }
  return isFinite(r)&&r>-1?r*100:null
}

function perfMetrics(snapshots) {
  if(!snapshots?.length) return null
  const last = snapshots[snapshots.length-1]
  const tv = last.accounts.reduce((s,a)=>s+(a.totalValue||0),0)
  const tc = last.accounts.reduce((s,a)=>s+(a.totalContributed||0),0)
  const pnl = last.accounts.reduce((s,a)=>s+(a.unrealizedPnL||a.fiscalPnL||0),0)
  const yr = new Date().getFullYear()
  const ytdS = snapshots.find(s=>s.date.startsWith(String(yr)))||snapshots[0]
  const ytdV = ytdS.accounts.reduce((s,a)=>s+(a.totalValue||0),0)
  const ytd = ytdV>0?((tv-ytdV)/ytdV)*100:0
  const first = snapshots[0]
  const years = (new Date(last.date)-new Date(first.date))/(365.25*864e5)
  const fv = first.accounts.reduce((s,a)=>s+(a.totalValue||0),0)
  const cagr = years>0.1&&fv>0?(Math.pow(tv/fv,1/years)-1)*100:null
  const cfs = []
  if(fv>0) cfs.push({date:first.date,amount:-fv})
  for(let i=0;i<snapshots.length-1;i++){
    const a=snapshots[i].accounts.reduce((s,a)=>s+(a.totalContributed||0),0)
    const b=snapshots[i+1].accounts.reduce((s,a)=>s+(a.totalContributed||0),0)
    const d=b-a; if(Math.abs(d)>10) cfs.push({date:snapshots[i+1].date,amount:-d})
  }
  cfs.push({date:last.date,amount:tv})
  return {tv,tc,pnl,pnlPct:tc>0?((tv-tc)/tc)*100:null,ytd,cagr,xirr:cfs.length>=2?xirr(cfs):null}
}


// ═══════════════════════════════════════════════════════════════════
// SMART IMPORT — Parser BoursoBank ciblé — v3 (tests: PEA 10/10, Binance ✓, AV ✓)
// ═══════════════════════════════════════════════════════════════════

// ── Helpers numériques ────────────────────────────────────────────
// ── Helpers numériques ────────────────────────────────────────────
function parseEUR(s) {
  if (!s) return null
  const m = s.match(/([+-]?\s*[\d\s\u00a0]+[,.][\d]{2})\s*€/)
  if (!m) return null
  return parseFloat(m[1].replace(/[\s\u00a0]/g,'').replace(',','.')) || null
}

function parsePCT(s) {
  if (!s) return null
  const m = s.match(/([+-]?\s*\d+[,.]\d+)\s*%/)
  if (!m) return null
  return parseFloat(m[1].replace(/\s/g,'').replace(',','.')) || null
}

function parseAmountStr(intStr, decStr) {
  return parseFloat(intStr.replace(/[\s\u00a0]/g,'') + '.' + decStr)
}

// ── Normalisation du texte BoursoBank ────────────────────────────
// BoursoBank génère "A\n\nV\n" (le bouton AV = Alerte/Vue) pour chaque position
// On fusionne ces lignes parasites en "AV" pour que le parser les reconnaisse
function normalizeRaw(text) {
  return text
    .replace(/\bA\s*\n+\s*V\b/g, 'AV')   // A + newlines + V → AV
    .replace(/\bA\s{2,}V\b/g, 'AV')       // A   V (espaces multiples) → AV
}

// ── ISIN → géographie et classe d'actif ──────────────────────────
function isinGeo(isin, name) {
  if (!isin) return ['GLOBAL']
  const K = {
    'FR0011871128':['US'], 'FR0011871110':['US'],
    'FR001400U5Q4':['US','EUROPE','JAPAN'],
    'FR0013412012':['EMERGING_ASIA'],
    'FR0010833715':['US','EUROPE'],
    'NL0000235190':['EUROPE'],
    'US46222L1089':['US'], 'US76655K1034':['US'],
    'FR0000052292':['FRANCE'], 'FR0000121014':['FRANCE'],
    'FR0000120073':['FRANCE'], 'FR0014004L86':['FRANCE'],
    'FR0000120271':['FRANCE'],
  }
  if (K[isin]) return K[isin]
  if (isin.startsWith('US')) return ['US']
  if (isin.startsWith('FR')) {
    if (/monde|world|msci.world/i.test(name||'')) return ['US','EUROPE','JAPAN']
    if (/emerging|asie.emerg|asia/i.test(name||'')) return ['EMERGING_ASIA']
    if (/nasdaq|s.?p.?500/i.test(name||'')) return ['US']
    return ['FRANCE']
  }
  if (/^(NL|DE|IT|ES|BE|CH)/.test(isin)) return ['EUROPE']
  if (isin.startsWith('LU')) return ['EUROPE','GLOBAL']
  return ['GLOBAL']
}

function isinAsset(isin, name) {
  const s = (name||'')+(isin||'')
  if (/support.euro|fonds.euro/i.test(s)) return 'BONDS'
  if (/equilibr|équilibr|dynamiqu|modér|isr|mixte|sérénit|serenite/i.test(s)) return 'MIXED'
  if (/monétaire|monetaire/i.test(s)) return 'MONEY_MARKET'
  if (/actions|europe i$|monde i$|internationales/i.test(s)) return 'EQUITIES'
  return 'EQUITIES'
}

function instName(hint) {
  if (/boursobank|bourso/i.test(hint)) return 'BoursoBank'
  if (/\blcl\b/i.test(hint)) return 'LCL'
  if (/natixis/i.test(hint)) return 'Natixis'
  if (/amundi/i.test(hint)) return 'Amundi'
  if (/binance/i.test(hint)) return 'Binance'
  return 'BoursoBank'
}

// ── Blacklist lignes parasites ────────────────────────────────────
const NOISE_RE = /^(\*|accéder|imprimer|exporter|guide|gestion libre|mes listes|mise au nominatif|actus|assemblées|tarification|fiscalité|mouvements|documents|ordres|performance$|positions.?rubrique|les données|besoin d|je découvre|pour optimis|chez bourso|le contrat|répartition de l|voir l.évolution|plafond de versement|mode de gestion|date d.ouverture|decouverte|valeurquantit|besoin|télécharge|quelle est|j.actualise|engagements en|valeurs éligibles|dates de liquid|mode d.emploi|couverture|total \+\/- val|total des \+\/- val|positions au comptant)/i

const GEO_NOISE_RE = /^(amérique du nord|amérique du sud|europe|asie.océanie|afrique|moyen orient|autres|les données de répartition)/i

const PERF_LINE_RE = /^([+\-]?\d+[,.]\d+\s*%|ma performance|performance.*cac|performance.*top|performance.*veille|performance.*mars|performance.*202)/i

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/

// ── Détection section de compte ───────────────────────────────────
const ACC_DEFS = [
  {re:/wallet.?binance|binance.?wallet|^binance$|^crypto$|compte.?crypto|portefeuille.?crypto/i, type:'CRYPTO', inst:'Binance'},
  {re:/\bLCL.?VIE\b|\bassurance.?vie\b/i,                   type:'AV',       inst:'LCL'},
  {re:/\bPEA\b.{0,30}(gonidec|le\s|notre)/i,                type:'PEA',      inst:'BoursoBank'},
  {re:/\bPEA\b/i,                                            type:'PEA',      inst:'BoursoBank'},
  {re:/\bCTO\b|\bcompte.?titres\b/i,                         type:'CTO',      inst:'BoursoBank'},
  {re:/\blivret.?a\b/i,                                      type:'LIVRET_A', inst:'BoursoBank'},
  {re:/pargne.{1,10}retraite|PERCO|PER.?COL/i,              type:'PERCO',    inst:'Natixis'},
  {re:/plan.?epargne.?salariale|plan.?épargne.?salariale|\bPEE\b/i, type:'PEE', inst:'Natixis'},
]

function isAccHeader(line) {
  if (line.length > 80) return null
  if (NOISE_RE.test(line)) return null
  if (/^[A-Z]{2}[A-Z0-9]{10}$/.test(line)) return null
  if (/^\d{5,}/.test(line)) return null  // numéro de compte
  if (DATE_RE.test(line)) return null
  return ACC_DEFS.find(d => d.re.test(line)) || null
}

// ── Parser Binance ────────────────────────────────────────────────
// Supporte 2 formats:
//   • One-liner: "BTC0.012123689,46 €ETH0.274610466,93 €..."  (6 décimales fixes)
//   • Tableau tabulation: "BTC\t0.012123\t689,49 €\nETH\t..."
function parseBinanceLine(text) {
  const TICKERS = ['BTC','ETH','BNB','SOL','USDC','USDT','BUSD','EUR','ADA','DOT','MATIC','AVAX','LINK']
  const STABLES = ['USDC','USDT','BUSD']
  const NAMES = {BTC:'Bitcoin',ETH:'Ethereum',BNB:'BNB',SOL:'Solana',
                 USDC:'USD Coin',USDT:'Tether',EUR:'EUR Binance',ADA:'Cardano'}
  const results = []

  // Format tableau (tabs): chaque ligne = "TICKER\tVOLUME\tMONTANT €"
  if (text.includes('\t') && text.includes('\n')) {
    const rows = text.split('\n').slice(1).filter(l => l.trim() && !l.startsWith('DEVISE'))
    for (const row of rows) {
      const parts = row.split('\t')
      if (parts.length < 3) continue
      const ticker = parts[0].trim().toUpperCase()
      if (!TICKERS.includes(ticker)) continue
      const qty = parseFloat(parts[1]?.replace(',','.')) || 0
      const eur = parseEUR(parts[2]) || parseFloat((parts[2]||'').replace(/[€\s\u00a0]/g,'').replace(',','.')) || 0
      if (eur >= 0) results.push({
        id:'h-'+ticker+'-'+Date.now(),
        name:NAMES[ticker]||ticker, ticker,
        assetClass:STABLES.includes(ticker)||ticker==='EUR'?'CASH':'CRYPTO',
        geography:ticker==='EUR'?['EUROPE']:['CRYPTO_GLOBAL'],
        quantity:qty, currency:ticker, currentValue:eur,
      })
    }
    return results
  }

  // Format one-liner (6 décimales fixes pour les volumes)
  const re = new RegExp(`(${TICKERS.join('|')})((?:(?!${TICKERS.join('|')}).)+)`, 'g')
  let m
  while ((m = re.exec(text)) !== null) {
    const ticker = m[1], data = m[2]
    const commaIdx = data.lastIndexOf(',')
    if (commaIdx < 0) continue
    const afterComma = data.slice(commaIdx + 1)
    if (!/^\d{2}\s*€/.test(afterComma)) continue
    const decPart = afterComma.slice(0, 2)
    const beforeComma = data.slice(0, commaIdx)
    const dotIdx = beforeComma.indexOf('.')
    let qty = 0, eur = 0
    if (dotIdx < 0) {
      eur = parseFloat(beforeComma.replace(/[\s\u00a0]/g,'') + '.' + decPart)
    } else {
      const volInt = beforeComma.slice(0, dotIdx)
      const afterDot = beforeComma.slice(dotIdx + 1)
      const volDec = afterDot.slice(0, 6) // BoursoBank: 6 décimales fixes
      const montantInt = afterDot.slice(6) || '0'
      qty = parseFloat(volInt + '.' + volDec)
      eur = parseFloat((montantInt||'0') + '.' + decPart)
    }
    if (eur >= 0) results.push({
      id:'h-'+ticker+'-'+Date.now(),
      name:NAMES[ticker]||ticker, ticker,
      assetClass:STABLES.includes(ticker)||ticker==='EUR'?'CASH':'CRYPTO',
      geography:ticker==='EUR'?['EUROPE']:['CRYPTO_GLOBAL'],
      quantity:qty, currency:ticker, currentValue:eur,
    })
  }
  return results
}

// ── Parser PEA/CTO ────────────────────────────────────────────────
// Dispatch inline vs multi-lignes selon la structure détectée
function parsePEABlock(blockLines) {
  const joined = blockLines.join(' ')
  // Inline si plusieurs "AV" sur peu de lignes avec ISIN dans le même texte
  const avCount = (joined.match(/\bAV\b/g)||[]).length
  const isinCount = (joined.match(/[A-Z]{2}[A-Z0-9]{10}/g)||[]).length
  if (avCount >= 2 && isinCount >= 2 && blockLines.length < avCount * 4) {
    return parsePEAInline(joined)
  }
  return parsePEAMultiline(blockLines)
}

// Format inline: tokenizer séquentiel → PX_REV, COURS, VAR%, MONTANT, PNL€, PNL%
function parsePEAInline(text) {
  const holdings = []
  const parts = text.split(/\bAV\b/).slice(1)
  for (const part of parts) {
    const p = part.trim()
    const isinM = p.match(/\b([A-Z]{2}[A-Z0-9]{10})\b/)
    if (!isinM) continue
    const isin = isinM[1]
    const isinPos = p.indexOf(isin)
    const name = p.slice(0, isinPos)
      .replace(/Ass\.?\s*Gén\.?/g,'').replace(/\s+/g,' ').trim()
    const after = p.slice(isinPos + 12).trim()
    // Tokenizer: EUR et PCT dans l'ordre d'apparition
    const tokens = []
    let pos = 0
    while (pos < after.length) {
      const eurM = after.slice(pos).match(/^([+-]?\s*[\d\s\u00a0]+[,.][\d]{2})\s*€/)
      if (eurM) {
        tokens.push({t:'EUR', v:parseFloat(eurM[1].replace(/[\s\u00a0]/g,'').replace(',','.'))})
        pos += eurM[0].length; continue
      }
      const pctM = after.slice(pos).match(/^([+-]?\s*\d+[,.]\d+)\s*%/)
      if (pctM) {
        tokens.push({t:'PCT', v:parseFloat(pctM[1].replace(/\s/g,'').replace(',','.'))})
        pos += pctM[0].length; continue
      }
      const intM = after.slice(pos).match(/^(\d+)(?:\s|$)/)
      if (intM && tokens.length === 0) {
        tokens.push({t:'QTY', v:parseInt(intM[1])}); pos += intM[0].length; continue
      }
      pos++
    }
    const eurT = tokens.filter(t=>t.t==='EUR')
    const pctT = tokens.filter(t=>t.t==='PCT')
    const qty = tokens.find(t=>t.t==='QTY')?.v || 1
    // Ordre BoursoBank: [0]=px_rev [1]=cours [2]=montant [3]=pnl
    const montant = eurT[2]?.v || eurT[1]?.v || 0
    const pnlEur = eurT[3]?.v || null
    const pnlPct = pctT[1]?.v || null
    if (montant > 0) holdings.push({
      id:'h-'+isin+'-'+Date.now(), name:name||isin, isin,
      assetClass:isinAsset(isin, name), geography:isinGeo(isin, name),
      quantity:qty, currency:'EUR', currentValue:montant,
      unrealizedPnL:pnlEur, unrealizedPnLPercent:pnlPct,
    })
  }
  return holdings
}

// Format multi-lignes: chaque champ sur sa ligne
// Structure: [AV\n] NOM\n [Ass.Gén.\n] ISIN\n QTY\n PX_REV€\n COURS€\n VAR%\n MONTANT€\n PNL€\n PNL%
function parsePEAMultiline(blockLines) {
  const holdings = []
  let i = 0
  while (i < blockLines.length) {
    const l = blockLines[i]
    if (/^(AV|Ass\.?\s*Gén\.?)$/i.test(l)) { i++; continue }
    if (NOISE_RE.test(l) || GEO_NOISE_RE.test(l) || DATE_RE.test(l)) { i++; continue }
    const win = blockLines.slice(i, i + 6)
    const isinIdx = win.findIndex(x => /^[A-Z]{2}[A-Z0-9]{10}$/.test(x))
    if (isinIdx < 0) { i++; continue }
    const name = win.slice(0, isinIdx)
      .filter(x => !/^(AV|Ass\.?\s*Gén\.?)$/i.test(x)).join(' ').trim()
    const isin = win[isinIdx]
    const after = blockLines.slice(i + isinIdx + 1, i + isinIdx + 8)
    const qty = parseFloat((after[0]||'').replace(',','.')) || 1
    const montant = parseEUR(after[4]) || 0
    const pnlEur = parseEUR(after[5])
    const pnlPct = parsePCT(after[6])
    if (montant > 0) holdings.push({
      id:'h-'+isin+'-'+Date.now(), name:name||isin, isin,
      assetClass:isinAsset(isin,name), geography:isinGeo(isin,name),
      quantity:qty, currency:'EUR', currentValue:montant,
      unrealizedPnL:pnlEur, unrealizedPnLPercent:pnlPct,
    })
    i = i + isinIdx + 8
  }
  return holdings
}

// ── Parser AV compact ─────────────────────────────────────────────
// "...SUPPORT EURO---23 606,42 €...LCL EQUILIBRE ETF SELECTFR0010833715..."
function parseAVCompact(line) {
  const holdings = []
  const headerIdx = line.search(/SUPPORT\s*EURO/i)
  const body = headerIdx >= 0 ? line.slice(headerIdx) : line
  // Support Euro
  const firstIsinIdx = body.search(/[A-Z]{2}\d[A-Z0-9]{9}/)
  const euroSeg = firstIsinIdx > 0 ? body.slice(0, firstIsinIdx) : body.slice(0, 120)
  const euroAmounts = [...euroSeg.matchAll(/([\d\s\u00a0]+),(\d{2})\s*€/g)]
    .map(m => parseAmountStr(m[1], m[2])).filter(v=>v>0).sort((a,b)=>b-a)
  const euroPct = parsePCT(euroSeg)
  if (euroAmounts[0] > 0) holdings.push({
    id:'h-support-euro-'+Date.now(), name:'Support Euro', isin:null,
    assetClass:'BONDS', geography:['UNKNOWN'], quantity:1, currency:'EUR',
    currentValue:euroAmounts[0], unrealizedPnL:euroAmounts[1]||null, unrealizedPnLPercent:euroPct,
  })
  // ETF/Fonds avec ISIN (doit contenir des chiffres)
  const isinRe = /([A-Z]{2}[A-Z0-9]{8}\d{2})/g
  let m
  while ((m = isinRe.exec(body)) !== null) {
    const isin = m[1]
    if (!/\d/.test(isin)) continue
    const before = body.slice(Math.max(0, m.index - 80), m.index)
    const nameM = before.match(/([A-ZÉÈÀÙÎÊÂÔÛÇ][A-ZÉÈÀÙÎÊÂÔÛÇ\s]+?)\s*$/)
    const name = nameM?.[1]?.trim().replace(/\s+/g,' ').slice(0,50) || isin
    const segRaw = body.slice(m.index + 12, m.index + 120)
    const amounts = [...segRaw.matchAll(/([\d\s\u00a0]+),(\d{2})\s*€/g)]
      .map(mm => parseAmountStr(mm[1], mm[2])).filter(v=>!isNaN(v))
    const pcts = [...segRaw.matchAll(/([+-]?\d+[,.]\d+)\s*%/g)]
      .map(mm=>parseFloat(mm[1].replace(',','.'))).filter(p=>Math.abs(p)<50)
    const montant = amounts.filter(v=>v>0).sort((a,b)=>b-a)[0] || 0
    const pnlEur = amounts.find(v=>v<0) || amounts.filter(v=>v>0&&v<montant*0.15)[0] || null
    const pnlPct = pcts.slice(-1)[0] || null
    if (montant > 0) holdings.push({
      id:'h-'+isin+'-'+Date.now(), name, isin,
      assetClass:isinAsset(isin,name), geography:isinGeo(isin,name),
      quantity:1, currency:'EUR', currentValue:montant,
      unrealizedPnL:pnlEur, unrealizedPnLPercent:pnlPct,
    })
  }
  return holdings
}

// ── Parser AV tableau (format tabulation multi-lignes) ────────────
// Format: NOM\n[DATE\n]QTY\t-\tCOURS\tMONTANT\tPNL\tPNL%
// ou sans tabs: NOM\nDATE\nQTY\n-\nCOURS\nMONTANT\nPNL\nPNL%  (LCL Vie tableau)
function parseAVTable(lines) {
  const holdings = []
  let i = 0
  while (i < lines.length) {
    const l = lines[i]
    if (NOISE_RE.test(l) || GEO_NOISE_RE.test(l) || DATE_RE.test(l)) { i++; continue }
    if (/^[-–]$/.test(l)) { i++; continue }
    // Chercher une ligne de données: commence par un nom sans ISIN
    // et suivie par des données numériques
    if (/^[A-ZÉÈÀÙ]/.test(l) && !DATE_RE.test(l) && !/^[A-Z]{2}[A-Z0-9]{10}$/.test(l) && l.length > 5) {
      const name = l
      // Regarder les lignes suivantes pour trouver les données
      const nextLines = lines.slice(i+1, i+12)
      let dataLine = null
      let skipOffset = 1
      // Chercher la ligne avec tabs ou plusieurs montants
      for (let k = 0; k < nextLines.length; k++) {
        const nl = nextLines[k]
        if (DATE_RE.test(nl) || /^[-–]$/.test(nl) || NOISE_RE.test(nl)) { skipOffset = k+2; continue }
        // Ligne de données tableau avec tabs
        if (nl.includes('\t') && (parseEUR(nl) !== null || parsePCT(nl) !== null)) {
          dataLine = nl; skipOffset = k + 2; break
        }
        // Ou si c'est juste une quantité
        if (/^\d+[.,]\d+$/.test(nl) || /^\d+$/.test(nl)) {
          // Mode multi-lignes: qty / '-' / cours / montant / pnl / pnl%
          const qty = parseFloat(nl.replace(',','.'))
          const afterQty = lines.slice(i+1+k+1, i+1+k+8).filter(x=>!/^[-–]$/.test(x)&&!DATE_RE.test(x))
          const eurVals = afterQty.map(parseEUR).filter(v=>v!==null)
          const pctVals = afterQty.map(parsePCT).filter(v=>v!==null&&Math.abs(v)<50)
          const montant = eurVals.filter(v=>v>0).sort((a,b)=>b-a)[0] || 0
          const pnlEur = eurVals.find(v=>v<0) || eurVals.filter(v=>v>0&&v<montant*0.2)[0] || null
          const pnlPct = pctVals.slice(-1)[0] || null
          if (montant > 0) {
            holdings.push({
              id:'h-'+name.slice(0,8)+'-'+Date.now(), name,
              assetClass:isinAsset(null,name), geography:['EUROPE','GLOBAL'],
              quantity:qty, currency:'EUR', currentValue:montant,
              unrealizedPnL:pnlEur, unrealizedPnLPercent:pnlPct,
            })
          }
          i = i + 1 + k + 7; break
        }
      }
      if (dataLine) {
        // Ligne avec tabs: QTY\t-\tCOURS\tMONTANT\tPNL\tPNL%
        const parts = dataLine.split('\t')
        const qty = parseFloat(parts[0]?.replace(',','.')) || 1
        const montant = parseEUR(parts[3]) || parseEUR(parts[2]) || 0
        const pnlEur = parseEUR(parts[4])
        const pnlPct = parsePCT(parts[5])
        if (montant > 0) {
          holdings.push({
            id:'h-'+name.slice(0,8)+'-'+Date.now(), name,
            assetClass:isinAsset(null,name), geography:['EUROPE','GLOBAL'],
            quantity:qty, currency:'EUR', currentValue:montant,
            unrealizedPnL:pnlEur, unrealizedPnLPercent:pnlPct,
          })
        }
        i += skipOffset
      } else {
        i++
      }
    } else {
      i++
    }
  }
  return holdings
}

// ── Parser principal ──────────────────────────────────────────────
function parseImport(raw) {
  // 1. JSON natif
  try {
    const p = JSON.parse(raw)
    if (p.accounts) return {accounts:p.accounts, source:'json'}
    if (Array.isArray(p)) return {accounts:p, source:'json'}
  } catch {}

  // 2. Normaliser: "A\nV" → "AV"
  const normalized = normalizeRaw(raw)
  const today = new Date().toISOString().split('T')[0]
  const lines = normalized.split(/\n/).map(l=>l.trim()).filter(l=>l.length>0)

  const accounts = []
  let curAcc = null
  let mode = 'none' // 'pea_cto' | 'av' | 'av_table' | 'binance' | 'natixis'
  let blockLines = []
  let binanceBuffer = ''

  const flushAcc = () => {
    if (!curAcc) return
    if (mode === 'pea_cto' && blockLines.length > 0) {
      curAcc.holdings = parsePEABlock(blockLines)
    } else if (mode === 'natixis' && blockLines.length > 0) {
      curAcc.holdings = parseAVTable(blockLines)
    } else if (mode === 'binance_table' && binanceBuffer) {
      curAcc.holdings = parseBinanceLine(binanceBuffer)
    }
    if (!curAcc.totalValue && curAcc.holdings.length > 0)
      curAcc.totalValue = curAcc.holdings.reduce((s,h)=>s+(h.currentValue||0), 0)
    curAcc.securitiesValue = Math.max(0, curAcc.totalValue - (curAcc.cashBalance||0))
    accounts.push(curAcc)
    curAcc=null; mode='none'; blockLines=[]; binanceBuffer=''
  }

  for (let i=0; i<lines.length; i++) {
    const l = lines[i]

    if (GEO_NOISE_RE.test(l)) continue
    if (PERF_LINE_RE.test(l) && !parseEUR(l)) continue

    const accDef = isAccHeader(l)
    if (accDef) {
      flushAcc()
      curAcc = {
        id: accDef.type.toLowerCase()+'-'+Date.now()+'-'+i,
        name: l.trim().slice(0,60),
        type: accDef.type,
        institution: {name: instName(l+' '+(lines[i+1]||'')+' '+accDef.inst)},
        snapshotDate: today,
        totalValue:0, cashBalance:0, securitiesValue:0, holdings:[],
      }
      mode = accDef.type==='CRYPTO' ? 'binance'
           : accDef.type==='AV'     ? 'av'
           : ['PERCO','PEE','PERCOL'].includes(accDef.type) ? 'natixis'
           : 'pea_cto'
      blockLines=[]; binanceBuffer=''
      continue
    }

    if (!curAcc) continue

    // ── Métadonnées communes ──
    if (/solde au|total port|valorisation en €|^[\d\s\u00a0]+[,.]\d{2}\s*€$/.test(l)) {
      const v=parseEUR(l); if(v&&v>100&&v>curAcc.totalValue) curAcc.totalValue=v
    }
    if (/solde esp.ces|espèces disponible|solde espèces/i.test(l)) {
      const v=parseEUR(lines[i+1]||'')||parseEUR(l); if(v&&v>0) curAcc.cashBalance=v
    }
    if (/total des \+\/- values?|montant \+\/- val/i.test(l)) {
      const combo=l+' '+(lines[i+1]||'')
      const v=parseEUR(combo); const p=parsePCT(combo)
      if(v) curAcc.unrealizedPnL=v; if(p) curAcc.unrealizedPnLPercent=p
    }
    if (/cumul des versements/i.test(l)) {
      const v=parseEUR(lines[i+1]||'')||parseEUR(l); if(v) curAcc.totalContributed=v
    }

    // ── Mode BINANCE ──
    if (mode==='binance') {
      // Tableau avec tabs (nouveau format avec colonnes)
      if (/DEVISE\s*\t|VOLUME\s*\t/i.test(l)) { mode='binance_table'; binanceBuffer=l+'\n'; continue }
      if (mode==='binance_table'||binanceBuffer) { binanceBuffer+=l+'\n'; continue }
      // One-liner
      if (/DEVISEVOLUME|BTC\d|ETH\d/i.test(l)) {
        curAcc.holdings=parseBinanceLine(l)
        if(!curAcc.totalValue&&curAcc.holdings.length)
          curAcc.totalValue=curAcc.holdings.reduce((s,h)=>s+h.currentValue,0)
      }
      continue
    }
    // Binance tableau: accumuler toutes les lignes
    if (mode==='binance_table') { binanceBuffer+=l+'\n'; continue }

    // ── Mode AV ──
    if (mode==='av') {
      if (/VALEURDATE|SUPPORT\s*EURO/i.test(l)) {
        curAcc.holdings=parseAVCompact(l)
      } else if (/VALEUR\s*\t.*DATE/i.test(l)) {
        mode='natixis' // LCL Vie tableau
      }
      continue
    }

    // ── Mode NATIXIS (tableau tabs) ──
    if (mode==='natixis') {
      if (NOISE_RE.test(l)||GEO_NOISE_RE.test(l)) continue
      blockLines.push(l)
      continue
    }

    // ── Mode PEA/CTO ──
    if (mode==='pea_cto') {
      if (/valeurquantit|valeur\s*\n?\s*quantit/i.test(l)) { blockLines=[]; continue }
      if (PERF_LINE_RE.test(l)) continue
      // Ignorer les lignes qui ressemblent à du crypto (tickers connus sans ISIN)
      if (/^(BTC|ETH|BNB|SOL|USDC|USDT|BUSD|ADA|DOT|MATIC|AVAX|LINK)\b/.test(l)) continue
      blockLines.push(l)
    }
  }

  flushAcc()

  // ── Déduplication ──
  const merged = []
  for (const acc of accounts) {
    const dup = merged.find(a=>a.type===acc.type&&a.institution?.name===acc.institution?.name)
    if (dup) {
      if (acc.holdings.length>dup.holdings.length) dup.holdings=acc.holdings
      if (acc.totalValue>dup.totalValue) dup.totalValue=acc.totalValue
    } else {
      merged.push(acc)
    }
  }

  return {accounts:merged, source:merged.length?'boursobank':'unknown'}
}

// ═══════════════════════════════════════════════════════════════════
// ALERTS ENGINE
// ═══════════════════════════════════════════════════════════════════
function computeAlerts(profile, accounts, geo, assets, tv) {
  const alerts = []
  const gm = Object.fromEntries(geo.map(g=>[g.zone,g.percent]))
  const am = Object.fromEntries(assets.map(a=>[a.label,a.percent]))
  const tgt = TARGETS[profile.riskProfile]||TARGETS.dynamique

  // US overexposure
  const usExp = (gm["États-Unis"]||0)
  if (usExp>58) alerts.push({
    lvl:"danger",icon:"🔴",cat:"Géographie",
    title:`Surexposition US : ${usExp.toFixed(0)}%`,
    detail:`${usExp.toFixed(1)}% d'exposition réelle aux États-Unis (correction ETF appliquée). Seuil conseillé : <58%.`,
    action:"→ Renforcer sur Amundi MSCI EM (FR0010959676) ou iShares MSCI Europe",
    metric:`${usExp.toFixed(0)}%`,
  })

  // Asset allocation gaps
  for (const [cls, t] of Object.entries(tgt)) {
    const c = am[cls]||0, gap = c-t
    if (Math.abs(gap)>10) alerts.push({
      lvl: gap>15?"danger":"warning", icon:gap>0?"🟡":"🔵", cat:"Allocation",
      title:`${cls} : ${gap>0?"+":""}${gap.toFixed(0)}% vs cible`,
      detail:`${c.toFixed(1)}% actuel vs ${t}% cible (profil ${profile.riskProfile}).`,
      action: gap>0?"→ Réorienter les prochains versements vers la classe sous-pondérée":"→ Renforcer sur les prochains apports",
      metric:`${gap>0?"+":""}${gap.toFixed(0)}%`,
    })
  }

  // PEA ceiling
  const pea = accounts.find(a=>a.type==="PEA")
  if (pea?.totalContributed && 150000-pea.totalContributed>5000) alerts.push({
    lvl:"info",icon:"✦",cat:"Fiscal",
    title:`PEA : ${f$(150000-pea.totalContributed,true)} disponible`,
    detail:`Plafond versements PEA non atteint. Enveloppe fiscalement la plus efficace sur actions.`,
    action:"→ Versements mensuels sur MSCI World ETF PEA (FR001400U5Q4)",
    metric:f$(150000-pea.totalContributed,true),
  })

  // Hermès stop-loss
  const hermes = pea?.holdings?.find(h=>h.isin==="FR0000052292")
  if (hermes && (hermes.unrealizedPnLPercent||0)<-12) alerts.push({
    lvl:"warning",icon:"⚠",cat:"Position",
    title:`Hermès −${Math.abs(hermes.unrealizedPnLPercent||0).toFixed(1)}%`,
    detail:`${f$(hermes.currentValue)} avec ${f$(hermes.unrealizedPnL)} de perte latente. Le secteur luxe reste sous pression.`,
    action:"→ DCA si conviction long terme · ou solder pour compenser des PV CTO",
    metric:fp(hermes.unrealizedPnLPercent),
  })

  // CTO losses
  const cto = accounts.find(a=>a.type==="CTO")
  if (cto && (cto.unrealizedPnLPercent||0)<-35) alerts.push({
    lvl:"danger",icon:"🔴",cat:"Perte",
    title:`CTO : ${fp(cto.unrealizedPnLPercent)}`,
    detail:`Valeurs quantiques en forte perte. Possible optimisation fiscale PFU si soldé.`,
    action:"→ Envisager de solder IonQ/Rigetti (moins-value imputable sur PV futures)",
    metric:fp(cto.unrealizedPnLPercent),
  })

  // Crypto below target
  const cryptoPct = am["Crypto-actifs"]||0
  if (cryptoPct<3 && profile.riskProfile!=="conservateur") alerts.push({
    lvl:"info",icon:"₿",cat:"Allocation",
    title:`Crypto sous-pondéré : ${cryptoPct.toFixed(1)}%`,
    detail:`Cible ${tgt["Crypto-actifs"]}% pour profil ${profile.riskProfile}. BTC reste la valeur refuge crypto.`,
    action:"→ DCA mensuel BTC sur Binance",
    metric:`${cryptoPct.toFixed(1)}%`,
  })

  return alerts.sort((a,b) => {const o={danger:0,warning:1,info:2}; return o[a.lvl]-o[b.lvl]})
}

// ═══════════════════════════════════════════════════════════════════
// REBALANCING ENGINE
// ═══════════════════════════════════════════════════════════════════
function computeRebalancing(profile, accounts, assets, tv, apport=0) {
  const tgt = TARGETS[profile.riskProfile]||TARGETS.dynamique
  const totalWithApport = tv + apport
  const rows = []
  for (const [cls, tPct] of Object.entries(tgt)) {
    const current = assets.find(a=>a.label===cls)
    const currentVal = current?.value||0
    const currentPct = current?.percent||0
    const targetVal = totalWithApport * tPct / 100
    const delta = targetVal - currentVal
    rows.push({cls,currentVal,currentPct,targetPct:tPct,targetVal,delta,color:C.aMap[Object.keys(ASSET_NAME).find(k=>ASSET_NAME[k]===cls)||"UNKNOWN"]||C.mut3})
  }
  return rows.sort((a,b)=>b.delta-a.delta)
}

// ═══════════════════════════════════════════════════════════════════
// ATOMS
// ═══════════════════════════════════════════════════════════════════
const Tag = ({c=C.acc,children,sm=true}) => (
  <span style={{...M,background:`${c}18`,color:c,border:`1px solid ${c}28`,
    padding:sm?"1px 8px":"3px 11px",borderRadius:3,
    fontSize:sm?"0.59rem":"0.67rem",letterSpacing:"0.07em",display:"inline-block",lineHeight:1.8}}>
    {children}
  </span>
)

const Box = ({children,style={}}) => (
  <div style={{background:C.s1,border:`1px solid ${C.b0}`,borderRadius:8,overflow:"hidden",...style}}>
    {children}
  </div>
)

const BoxHead = ({title,badge,right,hl}) => (
  <div style={{padding:"11px 16px",borderBottom:`1px solid ${C.b0}`,display:"flex",
    alignItems:"center",justifyContent:"space-between",background:hl?`${hl}0a`:C.s2}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <span style={{...S,fontSize:"0.9rem",color:C.tx}}>{title}</span>
      {badge&&<Tag c={C.mut3} sm>{badge}</Tag>}
    </div>
    {right}
  </div>
)

const Div = ({label}) => (
  <div style={{display:"flex",alignItems:"center",gap:10,margin:"22px 0 10px"}}>
    <span style={{...M,fontSize:"0.56rem",color:C.mut2,letterSpacing:"0.18em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{label}</span>
    <div style={{flex:1,height:1,background:`linear-gradient(90deg,${C.b1},transparent)`}}/>
  </div>
)

const TT = ({active,payload}) => {
  if(!active||!payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{background:C.s2,border:`1px solid ${C.b1}`,borderRadius:6,padding:"8px 12px"}}>
      <div style={{...M,fontSize:"0.62rem",color:C.mut3,marginBottom:3}}>{d.name||d.cls||d.zone||d.label||""}</div>
      <div style={{...M,fontSize:"0.78rem",color:C.tx}}>{typeof d.value==="number"?f$(d.value):d.value}</div>
      {d.percent!=null&&<div style={{...M,fontSize:"0.62rem",color:C.mut3}}>{d.percent.toFixed(1)}%</div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// PERF MODULE — TRI/XIRR/CAGR/YTD
// ═══════════════════════════════════════════════════════════════════
function PerfModule({metrics,snapshots}) {
  const hist = snapshots.map(s=>({
    date:s.date,
    value:s.accounts.reduce((sum,a)=>sum+(a.totalValue||0),0)
  }))

  return (
    <Box>
      <BoxHead title="Performance consolidée" badge="TRI · XIRR · CAGR · YTD"/>
      <div style={{padding:16}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:C.b0,borderRadius:6,overflow:"hidden",marginBottom:14}}>
          {[
            {l:"Total patrimoine",v:f$(metrics.tv),c:C.acc2},
            {l:"Performance globale",v:fp(metrics.pnlPct),c:pc(metrics.pnlPct)},
            {l:"YTD (depuis janv.)",v:fp(metrics.ytd),c:pc(metrics.ytd)},
            {l:metrics.cagr!=null?"CAGR annualisé":"Perf. nette",v:metrics.cagr!=null?fp(metrics.cagr):fp(metrics.pnlPct),c:pc(metrics.cagr||metrics.pnlPct)},
          ].map((k,i)=>(
            <div key={i} style={{background:C.s1,padding:"12px 14px"}}>
              <div style={{...M,fontSize:"0.56rem",color:C.mut2,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:5}}>{k.l}</div>
              <div style={{...S,fontSize:"1.3rem",color:k.c,lineHeight:1}}>{k.v}</div>
            </div>
          ))}
        </div>

        {metrics.xirr!=null&&(
          <div style={{background:`${C.acc}08`,border:`1px solid ${C.acc}20`,borderRadius:6,padding:"10px 14px",marginBottom:14,display:"flex",gap:14,alignItems:"center"}}>
            <div>
              <div style={{...M,fontSize:"0.56rem",color:C.acc,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:3}}>TRI — XIRR</div>
              <div style={{...S,fontSize:"1.7rem",color:C.acc2,lineHeight:1}}>{fp(metrics.xirr)}</div>
            </div>
            <div style={{...M,fontSize:"0.62rem",color:C.mut2,flex:1,lineHeight:1.8,borderLeft:`1px solid ${C.b1}`,paddingLeft:14}}>
              Rendement annualisé réel pondéré par les flux.<br/>
              <span style={{color:C.tx3}}>Livret A = 3% · Actions historique ≈ 7% / 20 ans · Objectif &gt; 6%</span>
            </div>
          </div>
        )}

        {hist.length>=2 ? (
          <div style={{height:120}}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hist} margin={{top:4,right:4,bottom:0,left:0}}>
                <defs>
                  <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.acc} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={C.acc} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 6" stroke={C.b0} vertical={false}/>
                <XAxis dataKey="date" tick={{...M,fontSize:"0.52rem",fill:C.mut3}} tickLine={false}/>
                <YAxis tickFormatter={v=>f$(v,true)} tick={{...M,fontSize:"0.52rem",fill:C.mut3}} tickLine={false} axisLine={false}/>
                <Tooltip content={<TT/>}/>
                <Area type="monotone" dataKey="value" stroke={C.acc} strokeWidth={2} fill="url(#ag)" dot={{fill:C.acc,r:3,strokeWidth:0}}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{height:70,display:"flex",alignItems:"center",justifyContent:"center",background:C.s2,borderRadius:6}}>
            <span style={{...M,fontSize:"0.62rem",color:C.mut2}}>Graphique dispo après 2+ imports</span>
          </div>
        )}
      </div>
    </Box>
  )
}

// ═══════════════════════════════════════════════════════════════════
// ALERTS PANEL
// ═══════════════════════════════════════════════════════════════════
function AlertsPanel({alerts}) {
  const [open,setOpen] = useState(true)
  const lc = {danger:C.red2,warning:C.amb2,info:C.blu2}
  const counts = {
    danger:alerts.filter(a=>a.lvl==="danger").length,
    warning:alerts.filter(a=>a.lvl==="warning").length,
    info:alerts.filter(a=>a.lvl==="info").length,
  }
  const hl = counts.danger?C.red:counts.warning?C.amb:C.blu

  return (
    <Box>
      <BoxHead title="Alertes & signaux" hl={hl}
        badge={`${alerts.length} actif${alerts.length>1?"s":""}`}
        right={
          <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
            {counts.danger>0&&<Tag c={C.red}>{counts.danger} critique{counts.danger>1?"s":""}</Tag>}
            {counts.warning>0&&<Tag c={C.amb}>{counts.warning} attention</Tag>}
            {counts.info>0&&<Tag c={C.blu}>{counts.info} info</Tag>}
            <button onClick={()=>setOpen(o=>!o)} style={{...M,background:"none",border:`1px solid ${C.b1}`,color:C.mut2,padding:"2px 8px",borderRadius:3,fontSize:"0.59rem",cursor:"pointer"}}>{open?"▲":"▼"}</button>
          </div>
        }/>
      {open&&(
        <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:7}}>
          {alerts.map((a,i)=>{
            const lev=lc[a.lvl]||C.blu2
            return(
              <div key={i} style={{background:`${lev}08`,border:`1px solid ${lev}20`,borderRadius:6,padding:"10px 14px"}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
                  <span style={{fontSize:"0.9rem"}}>{a.icon}</span>
                  <Tag c={lev} sm>{a.cat}</Tag>
                  <span style={{fontSize:"0.81rem",fontWeight:600,color:C.tx,flex:1}}>{a.title}</span>
                  <span style={{...M,fontSize:"0.7rem",color:lev}}>{a.metric}</span>
                </div>
                <p style={{fontSize:"0.73rem",color:C.tx3,margin:"0 0 5px",lineHeight:1.6}}>{a.detail}</p>
                <p style={{...M,fontSize:"0.66rem",color:lev,margin:0,borderLeft:`2px solid ${lev}35`,paddingLeft:8,lineHeight:1.7}}>{a.action}</p>
              </div>
            )
          })}
        </div>
      )}
    </Box>
  )
}

// ═══════════════════════════════════════════════════════════════════
// CHARTS — Donuts + Radar + Stacked bars
// ═══════════════════════════════════════════════════════════════════
function ChartsRow({accounts,tv,assets,geo}) {
  const [mode,setMode] = useState("pie")
  const byAcc = accounts.map(a=>({
    name:a.name.length>20?a.name.slice(0,18)+"…":a.name,
    value:a.totalValue,
    percent:(a.totalValue/tv)*100,
    color:C.cMap[a.type]||C.mut3,
  })).sort((a,b)=>b.value-a.value)

  const radarD = Object.entries(TARGETS.dynamique).map(([cls])=>({
    cls,
    Cible:TARGETS.dynamique[cls]||0,
    Actuel:assets.find(a=>a.label===cls)?.percent||0,
  }))

  const Donut = ({data,center}) => (
    <div style={{position:"relative",height:165}}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={48} outerRadius={70} paddingAngle={2} dataKey="value" strokeWidth={0}>
            {data.map((d,i)=><Cell key={i} fill={d.color||C.mut3}/>)}
          </Pie>
          <Tooltip content={<TT/>}/>
        </PieChart>
      </ResponsiveContainer>
      {center&&(
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
          <div style={{...S,fontSize:"0.92rem",color:C.acc2,lineHeight:1}}>{center.v}</div>
          <div style={{...M,fontSize:"0.48rem",color:C.mut2,marginTop:2,letterSpacing:"0.1em",textTransform:"uppercase"}}>{center.l}</div>
        </div>
      )}
    </div>
  )

  const Legend = ({data}) => (
    <div style={{display:"flex",flexDirection:"column",gap:3,marginTop:8}}>
      {data.slice(0,6).map((d,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:d.color||C.mut3,flexShrink:0}}/>
          <span style={{fontSize:"0.68rem",color:C.tx3,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name||d.label||d.zone}</span>
          <span style={{...M,fontSize:"0.62rem",color:C.tx}}>{(d.percent||0).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )

  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
      <Box>
        <BoxHead title="Par enveloppe"/>
        <div style={{padding:"12px 16px"}}>
          <Donut data={byAcc} center={{v:f$(tv,true),l:"total"}}/>
          <Legend data={byAcc}/>
        </div>
      </Box>

      <Box>
        <BoxHead title="Allocation" right={
          <div style={{display:"flex",gap:3}}>
            {[["pie","◉"],["radar","◎"],["bar","▬"]].map(([k,l])=>(
              <button key={k} onClick={()=>setMode(k)} style={{...M,padding:"2px 7px",borderRadius:3,border:`1px solid ${mode===k?C.acc:C.b1}`,background:mode===k?`${C.acc}15`:"none",color:mode===k?C.acc:C.mut2,fontSize:"0.59rem",cursor:"pointer"}}>{l}</button>
            ))}
          </div>
        }/>
        <div style={{padding:"12px 16px"}}>
          {mode==="pie"&&(
            <>
              <Donut data={assets.map(a=>({...a,name:a.label,color:C.aMap[a.cls]||C.mut3}))} center={{v:assets[0]?.percent?.toFixed(0)+"%",l:(assets[0]?.label||"").slice(0,8)}}/>
              <Legend data={assets.map(a=>({...a,name:a.label,color:C.aMap[a.cls]||C.mut3}))}/>
            </>
          )}
          {mode==="radar"&&(
            <>
              <div style={{height:195}}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarD}>
                    <PolarGrid stroke={C.b1}/>
                    <PolarAngleAxis dataKey="cls" tick={{...M,fontSize:"0.53rem",fill:C.mut2}}/>
                    <Radar name="Actuel" dataKey="Actuel" stroke={C.acc} fill={C.acc} fillOpacity={0.15}/>
                    <Radar name="Cible" dataKey="Cible" stroke={C.amb} fill={C.amb} fillOpacity={0.08} strokeDasharray="4 2"/>
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div style={{display:"flex",gap:14,justifyContent:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:12,height:2,background:C.acc}}/><span style={{...M,fontSize:"0.57rem",color:C.mut2}}>Actuel</span></div>
                <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:12,height:2,background:C.amb}}/><span style={{...M,fontSize:"0.57rem",color:C.mut2}}>Cible dynamique</span></div>
              </div>
            </>
          )}
          {mode==="bar"&&(
            <div style={{height:225}}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assets.map(a=>({name:a.label.slice(0,10),Actuel:a.percent,Cible:TARGETS.dynamique[a.label]||0}))} margin={{top:4,right:4,bottom:0,left:-20}}>
                  <CartesianGrid strokeDasharray="2 6" stroke={C.b0} vertical={false}/>
                  <XAxis dataKey="name" tick={{...M,fontSize:"0.5rem",fill:C.mut2}} tickLine={false}/>
                  <YAxis tick={{...M,fontSize:"0.5rem",fill:C.mut2}} tickLine={false} axisLine={false}/>
                  <Tooltip content={<TT/>}/>
                  <Bar dataKey="Actuel" fill={C.acc} opacity={0.8} radius={[3,3,0,0]}/>
                  <Bar dataKey="Cible" fill={C.amb} opacity={0.4} radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Box>

      <Box>
        <BoxHead title="Géographie réelle" badge="ETF corrigés"/>
        <div style={{padding:"12px 16px"}}>
          <Donut data={geo.slice(0,7).map(g=>({...g,name:g.zone,color:C.gMap[g.zone]||C.mut3}))} center={{v:geo[0]?.percent?.toFixed(0)+"%",l:geo[0]?.zone?.slice(0,8)||""}}/>
          <Legend data={geo.slice(0,6).map(g=>({name:g.zone,percent:g.percent,color:C.gMap[g.zone]||C.mut3}))}/>
          <div style={{...M,fontSize:"0.55rem",color:C.mut2,marginTop:8,lineHeight:1.8,borderTop:`1px solid ${C.b0}`,paddingTop:7}}>
            ✓ S&P 500 → 98% US · MSCI World → 65% US · NASDAQ → 98% US
          </div>
        </div>
      </Box>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// REBALANCING PANEL
// ═══════════════════════════════════════════════════════════════════
function RebalancingPanel({profile,accounts,assets,tv}) {
  const [apport,setApport] = useState(0)
  const [rp,setRp] = useState(profile.riskProfile)
  const rows = useMemo(()=>computeRebalancing({...profile,riskProfile:rp},accounts,assets,tv,apport),[profile,rp,accounts,assets,tv,apport])
  const needsAction = rows.filter(r=>Math.abs(r.delta)>200)

  return(
    <Box>
      <BoxHead title="Rééquilibrage recommandé" badge={`${needsAction.length} actions`}
        right={
          <div style={{display:"flex",gap:4}}>
            {Object.keys(TARGETS).map(k=>(
              <button key={k} onClick={()=>setRp(k)} style={{...M,padding:"2px 8px",borderRadius:3,border:`1px solid ${rp===k?C.acc:C.b1}`,background:rp===k?`${C.acc}15`:"none",color:rp===k?C.acc:C.mut2,fontSize:"0.59rem",cursor:"pointer"}}>{k}</button>
            ))}
          </div>
        }/>
      <div style={{padding:"14px 16px"}}>
        {/* Apport slider */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,background:C.s2,borderRadius:6,padding:"10px 14px"}}>
          <span style={{...M,fontSize:"0.62rem",color:C.mut2,whiteSpace:"nowrap"}}>Apport mensuel :</span>
          <input type="range" min={0} max={5000} step={50} value={apport} onChange={e=>setApport(Number(e.target.value))} style={{flex:1,accentColor:C.acc,cursor:"pointer",height:4}}/>
          <span style={{...M,fontSize:"0.72rem",color:C.acc,minWidth:60,textAlign:"right"}}>{f$(apport,true)}</span>
        </div>

        {/* Table */}
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr>
              {["Classe","Actuel","Cible","Écart","Action recommandée"].map(h=>(
                <th key={h} style={{...M,padding:"6px 8px",fontSize:"0.56rem",color:C.mut2,textTransform:"uppercase",letterSpacing:"0.08em",textAlign:h==="Classe"?"left":"right",borderBottom:`1px solid ${C.b0}`}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({cls,currentVal,currentPct,targetPct,targetVal,delta,color})=>(
              <tr key={cls} style={{borderBottom:`1px solid ${C.b0}20`}}>
                <td style={{padding:"8px",fontSize:"0.77rem",color:C.tx}}>{cls}</td>
                <td style={{...M,padding:"8px",fontSize:"0.69rem",color:C.mut2,textAlign:"right"}}>{currentPct.toFixed(1)}%</td>
                <td style={{...M,padding:"8px",fontSize:"0.69rem",color:C.mut2,textAlign:"right"}}>{targetPct}%</td>
                <td style={{...M,padding:"8px",fontSize:"0.69rem",textAlign:"right",color:Math.abs(currentPct-targetPct)<3?C.mut2:currentPct>targetPct?C.acc:C.red}}>
                  {(currentPct-targetPct)>0?"+":""}{(currentPct-targetPct).toFixed(1)}%
                </td>
                <td style={{padding:"8px",textAlign:"right"}}>
                  {Math.abs(delta)<200
                    ? <span style={{...M,fontSize:"0.63rem",color:C.mut2}}>✓ OK</span>
                    : <span style={{...M,fontSize:"0.67rem",color:delta>0?C.amb2:C.blu2,background:`${delta>0?C.amb:C.blu}12`,border:`1px solid ${delta>0?C.amb:C.blu}25`,padding:"2px 8px",borderRadius:4}}>
                        {delta>0?"↓ Alléger":"↑ Renforcer"} {f$(Math.abs(delta),true)}
                      </span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {needsAction.length>0&&(
          <div style={{marginTop:12,background:C.s2,borderRadius:6,padding:"10px 14px"}}>
            <div style={{...M,fontSize:"0.57rem",color:C.acc,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>Plan d'action</div>
            {needsAction.map((r,i)=>(
              <div key={i} style={{fontSize:"0.73rem",color:C.tx2,lineHeight:1.9,marginBottom:2}}>
                <span style={{color:r.delta<0?C.acc:C.amb2}}>{r.delta<0?"↑":"↓"}</span>
                {" "}<strong>{r.cls}</strong> : {r.delta<0?"renforcer":"alléger"} <span style={{...M,color:C.tx}}>{f$(Math.abs(r.delta),true)}</span>
                <span style={{color:C.mut2}}> ({r.delta<0?`${r.currentPct.toFixed(1)}% → ${r.targetPct}%`:`${r.currentPct.toFixed(1)}% → ${r.targetPct}%`})</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Box>
  )
}

// ═══════════════════════════════════════════════════════════════════
// WHAT-IF SIMULATOR
// ═══════════════════════════════════════════════════════════════════
function Simulator({accounts,tv}) {
  const [drop,setDrop] = useState(20)
  const [peaAdd,setPeaAdd] = useState(0)
  const [crypAdd,setCrypAdd] = useState(0)
  const [bonds,setBonds] = useState(0)

  const sim = useMemo(()=>{
    let total=0
    const detail=[]
    for(const acc of accounts){
      let v=acc.totalValue
      if(["PEA","CTO"].includes(acc.type)) v*=(1-drop/100)
      else if(acc.type==="CRYPTO") v*=(1-drop*1.65/100)
      else if(acc.type==="AV"){
        const b=(acc.holdings||[]).reduce((s,h)=>h.assetClass==="BONDS"?s+h.currentValue:s,0)
        v=b*(1+bonds/100)+(v-b)*(1-drop/100)
      }
      else if(["PEE","PERCO","PERCOL"].includes(acc.type)) v*=(1-drop*0.5/100)
      if(acc.type==="PEA") v+=peaAdd
      if(acc.type==="CRYPTO") v+=crypAdd
      const d=v-acc.totalValue
      detail.push({name:acc.name,type:acc.type,orig:acc.totalValue,sim:v,d,dp:(v/acc.totalValue-1)*100})
      total+=v
    }
    return{total,d:total-tv,dp:(total/tv-1)*100,detail}
  },[accounts,tv,drop,peaAdd,crypAdd,bonds])

  const Slider = ({label,val,set,min,max,step=1,unit="%",col=C.acc}) => (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
        <span style={{...M,fontSize:"0.61rem",color:C.mut2}}>{label}</span>
        <span style={{...M,fontSize:"0.67rem",color:col}}>{val>0?"+":""}{val}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={e=>set(Number(e.target.value))} style={{width:"100%",accentColor:col,cursor:"pointer",height:4}}/>
    </div>
  )

  const presets = [
    {l:"Crash −30%",fn:()=>{setDrop(30);setPeaAdd(0);setCrypAdd(0);setBonds(0)}},
    {l:"Correction −20%",fn:()=>{setDrop(20);setPeaAdd(0);setCrypAdd(0);setBonds(0)}},
    {l:"Bull +20%",fn:()=>{setDrop(-20);setPeaAdd(0);setCrypAdd(0);setBonds(0)}},
    {l:"DCA PEA +5k€",fn:()=>{setDrop(0);setPeaAdd(5000);setCrypAdd(0);setBonds(0)}},
    {l:"Reset",fn:()=>{setDrop(0);setPeaAdd(0);setCrypAdd(0);setBonds(0)}},
  ]

  return(
    <Box>
      <BoxHead title="Simulateur What-If" badge="Multi-scénarios" hl={C.blu}
        right={<Tag c={C.blu}>Interactif</Tag>}/>
      <div style={{padding:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div>
          <div style={{...M,fontSize:"0.56rem",color:C.mut2,marginBottom:12,letterSpacing:"0.1em",textTransform:"uppercase"}}>Paramètres</div>
          <Slider label="Chute actions / crypto" val={-drop} set={v=>setDrop(-v)} min={-50} max={50} col={drop>0?C.red:C.acc}/>
          <Slider label="Impact obligations (AV)" val={bonds} set={setBonds} min={-10} max={5} col={C.amb}/>
          <Slider label="Apport PEA (€)" val={peaAdd} set={setPeaAdd} min={0} max={60000} step={500} unit="€" col={C.acc}/>
          <Slider label="Apport Crypto (€)" val={crypAdd} set={setCrypAdd} min={0} max={10000} step={100} unit="€" col="#d4c820"/>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:10}}>
            {presets.map(({l,fn},i)=>(
              <button key={i} onClick={fn} style={{...M,padding:"4px 9px",borderRadius:4,border:`1px solid ${C.b1}`,background:C.s2,color:C.mut2,fontSize:"0.59rem",cursor:"pointer"}}>{l}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={{...M,fontSize:"0.56rem",color:C.mut2,marginBottom:12,letterSpacing:"0.1em",textTransform:"uppercase"}}>Impact simulé</div>
          <div style={{background:sim.d<0?`${C.red}10`:`${C.acc}10`,border:`1px solid ${sim.d<0?C.red:C.acc}25`,borderRadius:8,padding:16,marginBottom:12,textAlign:"center"}}>
            <div style={{...S,fontSize:"1.75rem",color:sim.d<0?C.red2:C.acc2,lineHeight:1}}>{f$(sim.total)}</div>
            <div style={{...M,fontSize:"0.7rem",color:pc(sim.d),marginTop:6}}>
              {sim.d>=0?"+":""}{f$(sim.d,true)} · {fp(sim.dp)}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {sim.detail.filter(d=>Math.abs(d.d)>10).slice(0,6).map((d,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${C.b0}`}}>
                <span style={{fontSize:"0.7rem",color:C.tx2,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</span>
                <span style={{...M,fontSize:"0.66rem",color:pc(d.d)}}>{d.d>=0?"+":""}{f$(d.d,true)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Box>
  )
}

// ═══════════════════════════════════════════════════════════════════
// ALLOCATION TABLE
// ═══════════════════════════════════════════════════════════════════
function AllocTable({profile,assets,tv}) {
  const [rp,setRp] = useState(profile.riskProfile)
  const tgt = TARGETS[rp]||TARGETS.dynamique
  const rows = Object.entries(tgt).map(([cls,t])=>{
    const c=assets.find(a=>a.label===cls)?.percent||0
    const g=c-t
    return{cls,t,c,g,reb:Math.abs(g/100)*tv}
  })
  return(
    <Box>
      <BoxHead title="Allocation cible vs réelle" badge={rp}
        right={
          <div style={{display:"flex",gap:3}}>
            {Object.keys(TARGETS).map(k=>(
              <button key={k} onClick={()=>setRp(k)} style={{...M,padding:"2px 8px",borderRadius:3,border:`1px solid ${rp===k?C.acc:C.b1}`,background:rp===k?`${C.acc}15`:"none",color:rp===k?C.acc:C.mut2,fontSize:"0.59rem",cursor:"pointer"}}>{k}</button>
            ))}
          </div>
        }/>
      <div style={{padding:"12px 16px"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr>{["Classe","Cible","Actuel","Écart","À rééquilibrer"].map(h=>(
              <th key={h} style={{...M,padding:"6px 8px",fontSize:"0.56rem",color:C.mut2,textTransform:"uppercase",letterSpacing:"0.08em",textAlign:h==="Classe"?"left":"right",borderBottom:`1px solid ${C.b0}`}}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map(({cls,t,c,g,reb})=>(
              <tr key={cls} style={{borderBottom:`1px solid ${C.b0}20`}}>
                <td style={{padding:"8px",fontSize:"0.77rem",color:C.tx}}>{cls}</td>
                <td style={{...M,padding:"8px",fontSize:"0.69rem",color:C.mut2,textAlign:"right"}}>{t}%</td>
                <td style={{...M,padding:"8px",fontSize:"0.69rem",color:C.tx,textAlign:"right"}}>{c.toFixed(1)}%</td>
                <td style={{...M,padding:"8px",fontSize:"0.69rem",textAlign:"right",color:Math.abs(g)<3?C.mut2:g>0?C.acc:C.red}}>{g>0?"+":""}{g.toFixed(1)}%</td>
                <td style={{...M,padding:"8px",fontSize:"0.69rem",textAlign:"right",color:Math.abs(g)<3?C.mut2:C.amb2}}>{Math.abs(g)>=3?`${g<0?"+":"-"}${f$(reb,true)}`:"✓ OK"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Box>
  )
}

// ═══════════════════════════════════════════════════════════════════
// HOLDINGS TABLE
// ═══════════════════════════════════════════════════════════════════
function HoldingsTable({accounts}) {
  const [sort,setSort] = useState({k:"currentValue",d:-1})
  const [filter,setFilter] = useState("all")
  const [q,setQ] = useState("")

  const all = useMemo(()=>accounts.flatMap(a=>(a.holdings||[]).map(h=>({...h,accName:a.name,accType:a.type}))),[accounts])
  const rows = useMemo(()=>{
    let r = filter==="all"?all:all.filter(h=>h.accType===filter)
    if(q) r=r.filter(h=>(h.name||"").toLowerCase().includes(q.toLowerCase())||(h.isin||"").includes(q.toUpperCase()))
    return [...r].sort((a,b)=>{
      const av=a[sort.k]??(sort.d<0?-Infinity:Infinity)
      const bv=b[sort.k]??(sort.d<0?-Infinity:Infinity)
      return typeof av==="string"?sort.d*av.localeCompare(bv):sort.d*(av-bv)
    })
  },[all,filter,q,sort])

  const types = [...new Set(all.map(h=>h.accType))]
  const Th = ({l,k}) => (
    <th onClick={()=>setSort(s=>s.k===k?{k,d:-s.d}:{k,d:-1})}
      style={{...M,padding:"7px 10px",fontSize:"0.56rem",color:sort.k===k?C.acc:C.mut2,
        letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer",
        textAlign:k==="name"?"left":"right",borderBottom:`1px solid ${C.b0}`,
        background:C.s2,userSelect:"none",whiteSpace:"nowrap"}}>
      {l}{sort.k===k?sort.d<0?" ↓":" ↑":" ↕"}
    </th>
  )

  return(
    <Box>
      <BoxHead title="Positions" badge={`${rows.length}/${all.length}`}
        right={
          <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Recherche…"
              style={{...M,background:C.s2,border:`1px solid ${C.b1}`,borderRadius:4,
                padding:"3px 8px",color:C.tx,fontSize:"0.62rem",width:100,outline:"none"}}/>
            {["all",...types].map(t=>(
              <button key={t} onClick={()=>setFilter(t)} style={{...M,padding:"3px 8px",borderRadius:3,
                border:`1px solid ${filter===t?(t==="all"?C.acc:C.cMap[t]||C.acc):C.b1}`,
                background:filter===t?`${t==="all"?C.acc:C.cMap[t]||C.acc}15`:"none",
                color:filter===t?(t==="all"?C.acc:C.cMap[t]||C.acc):C.mut2,
                fontSize:"0.59rem",cursor:"pointer"}}>
                {t==="all"?"Tout":ACC_NAME[t]||t}
              </button>
            ))}
          </div>
        }/>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>
            <Th l="Valeur" k="name"/>
            <Th l="Enveloppe" k="accType"/>
            <Th l="Qté" k="quantity"/>
            <Th l="Montant" k="currentValue"/>
            <Th l="+/- Latent" k="unrealizedPnL"/>
            <Th l="+/- %" k="unrealizedPnLPercent"/>
            <Th l="Perf 1an" k="perf1y"/>
            <Th l="SRRI" k="riskLevel"/>
          </tr></thead>
          <tbody>
            {rows.map(h=>{
              const pnl=h.unrealizedPnL??h.fiscalPnL
              const pp=h.unrealizedPnLPercent
              return(
                <tr key={h.id} style={{borderBottom:`1px solid ${C.b0}20`}}
                  onMouseEnter={e=>e.currentTarget.style.background=`${C.s2}80`}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{padding:"9px 10px"}}>
                    <div style={{fontSize:"0.78rem",color:C.tx,fontWeight:500}}>{h.name}</div>
                    <div style={{...M,fontSize:"0.58rem",color:C.mut2}}>{h.isin||h.ticker||""}</div>
                  </td>
                  <td style={{padding:"9px 10px"}}>
                    <Tag c={C.cMap[h.accType]||C.mut2} sm>{ACC_NAME[h.accType]||h.accType}</Tag>
                  </td>
                  <td style={{...M,padding:"9px 10px",fontSize:"0.67rem",color:C.mut2,textAlign:"right"}}>{(h.quantity||0).toLocaleString("fr-FR",{maximumFractionDigits:4})}</td>
                  <td style={{...M,padding:"9px 10px",fontSize:"0.76rem",color:C.tx,textAlign:"right"}}>{f$(h.currentValue)}</td>
                  <td style={{...M,padding:"9px 10px",fontSize:"0.7rem",textAlign:"right",color:pnl==null?C.mut2:pc(pnl)}}>
                    {pnl!=null?`${pnl>=0?"+":""}${f$(pnl)}${h.fiscalPnL&&!h.unrealizedPnL?" (f.)":""}` : "—"}
                  </td>
                  <td style={{...M,padding:"9px 10px",fontSize:"0.7rem",textAlign:"right",color:pp==null?C.mut2:pc(pp)}}>{pp!=null?fp(pp):"—"}</td>
                  <td style={{...M,padding:"9px 10px",fontSize:"0.66rem",textAlign:"right",color:h.perf1y!=null?pc(h.perf1y):C.mut2}}>{h.perf1y!=null?fp(h.perf1y):"—"}</td>
                  <td style={{padding:"9px 10px",textAlign:"center"}}>
                    {h.riskLevel?<Tag c={["","#1a9870","#7dc830","#c88018","#c86028","#c04040","#a03030","#800000"][h.riskLevel]||C.mut} sm>{h.riskLevel}/7</Tag>:"—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Box>
  )
}

// ═══════════════════════════════════════════════════════════════════
// GEO BAR CHART
// ═══════════════════════════════════════════════════════════════════
function GeoBar({geo}) {
  return(
    <Box>
      <BoxHead title="Exposition géographique détaillée" badge="Pondération ETF réelle"/>
      <div style={{padding:"14px 16px"}}>
        {geo.map((g,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"140px 1fr 80px 55px",alignItems:"center",gap:10,marginBottom:10}}>
            <span style={{fontSize:"0.78rem",color:C.tx3}}>{g.zone}</span>
            <div style={{height:6,background:C.s2,borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:4,background:C.gMap[g.zone]||C.mut3,width:`${Math.min(g.percent,100)}%`,transition:"width 0.3s"}}/>
            </div>
            <span style={{...M,fontSize:"0.7rem",color:C.tx,textAlign:"right"}}>{f$(g.value,true)}</span>
            <span style={{...M,fontSize:"0.68rem",color:C.mut2,textAlign:"right"}}>{g.percent.toFixed(1)}%</span>
          </div>
        ))}
        <p style={{...M,fontSize:"0.59rem",color:C.mut2,marginTop:12,lineHeight:1.9,borderTop:`1px solid ${C.b0}`,paddingTop:10}}>
          ✓ Correction ETF appliquée — S&P 500 98% US · NASDAQ 98% US · MSCI World 65% US / 15% EU / 7% JP<br/>
          Plus de "Other" ni "Unknown" — zones non identifiables classées en "Monde diversifié" ou "Non géolocalisé"
        </p>
      </div>
    </Box>
  )
}

// ═══════════════════════════════════════════════════════════════════
// IMPORT PAGE — Smart parser multi-format
// ═══════════════════════════════════════════════════════════════════
function ImportPage({profiles,onImport}) {
  const [raw,setRaw] = useState("")
  const [pid,setPid] = useState(profiles[0]?.id||"")
  const [status,setStatus] = useState(null)
  const [preview,setPreview] = useState(null)

  const analyze = () => {
    if(!raw.trim()){setStatus({ok:false,msg:"Colle d'abord tes données"});return}
    const result = parseImport(raw)
    if(!result.accounts?.length){setStatus({ok:false,msg:"Format non reconnu — essaie JSON ou texte BoursoBank/Natixis"});return}
    setPreview(result)
    const srcLabel={json:"JSON natif",boursobank:"BoursoBank",unknown:"format inconnu"}[result.source]||result.source; setStatus({ok:true,msg:`✓ ${result.accounts.length} compte(s) · format ${srcLabel}`})
  }

  const confirm = () => {
    if(!preview) return
    onImport(pid, preview.accounts)
    setRaw(""); setPreview(null)
    setStatus({ok:true,msg:"✓ Importé avec succès"})
  }

  return(
    <div style={{maxWidth:800,margin:"0 auto",padding:"32px 20px"}}>
      <h1 style={{...S,fontSize:"1.8rem",color:C.tx,marginBottom:6}}>Import <span style={{color:C.acc}}>Données</span></h1>
      <p style={{...M,fontSize:"0.65rem",color:C.mut2,marginBottom:24,lineHeight:1.9}}>
        Colle n'importe quelle données — JSON structuré, copier-coller BoursoBank, Natixis, Amundi.<br/>
        Le parser détecte automatiquement le format, les comptes, les positions et les ISIN.
      </p>

      <Box style={{marginBottom:16}}>
        <BoxHead title="Source" right={
          <div style={{display:"flex",gap:6}}>
            {profiles.map(p=>(
              <button key={p.id} onClick={()=>setPid(p.id)} style={{...M,padding:"5px 12px",borderRadius:4,border:`1px solid ${pid===p.id?p.color:C.b1}`,background:pid===p.id?`${p.color}18`:"none",color:pid===p.id?p.color:C.mut2,fontSize:"0.67rem",cursor:"pointer"}}>{p.name}</button>
            ))}
          </div>
        }/>
        <div style={{padding:16}}>
          <textarea value={raw} onChange={e=>{setRaw(e.target.value);setPreview(null);setStatus(null)}}
            placeholder={"Formats acceptés :\n\n• JSON : {\"accounts\": [{\"type\":\"PEA\", \"totalValue\":6348, ...}]}\n\n• Texte libre BoursoBank :\n  PEA LE GONIDEC        6 348,80 €\n  Hermès International  FR0000052292   2 049,00 €  −14,42%\n  ...\n\n• Copier-coller tableau Natixis / Amundi"}
            style={{width:"100%",height:220,background:C.s2,border:`1px solid ${C.b1}`,borderRadius:6,padding:12,color:C.tx,...M,fontSize:"0.7rem",resize:"vertical",outline:"none",lineHeight:1.8}}/>
          <div style={{display:"flex",gap:8,marginTop:10,alignItems:"center"}}>
            <button onClick={analyze} style={{...M,padding:"8px 16px",background:`${C.acc}18`,border:`1px solid ${C.acc}35`,color:C.acc,borderRadius:6,fontSize:"0.72rem",cursor:"pointer"}}>
              ① Analyser
            </button>
            {preview&&(
              <button onClick={confirm} style={{...M,padding:"8px 16px",background:`${C.blu}18`,border:`1px solid ${C.blu2}35`,color:C.blu2,borderRadius:6,fontSize:"0.72rem",cursor:"pointer"}}>
                ② Confirmer l'import
              </button>
            )}
            {status&&<span style={{...M,fontSize:"0.7rem",color:status.ok?C.acc:C.amb2}}>{status.msg}</span>}
          </div>
        </div>
      </Box>

      {/* Preview */}
      {preview&&(
        <Box>
          <BoxHead title="Aperçu avant import" badge={`${preview.accounts.length} comptes`}/>
          <div style={{padding:"12px 16px"}}>
            {preview.accounts.map((acc,i)=>(
              <div key={i} style={{background:C.s2,borderRadius:6,padding:"10px 14px",marginBottom:8,borderLeft:`3px solid ${C.cMap[acc.type]||C.mut3}`}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:"0.8rem",color:C.tx,fontWeight:500}}>{acc.name||acc.id}</span>
                  <div style={{display:"flex",gap:6}}>
                    <Tag c={C.cMap[acc.type]||C.mut2} sm>{acc.type}</Tag>
                    <span style={{...M,fontSize:"0.72rem",color:C.acc}}>{f$(acc.totalValue)}</span>
                  </div>
                </div>
                {acc.holdings?.length>0&&(
                  <div style={{...M,fontSize:"0.62rem",color:C.mut2}}>{acc.holdings.length} position(s) : {acc.holdings.slice(0,3).map(h=>h.name||h.isin||"?").join(", ")}{acc.holdings.length>3?"…":""}</div>
                )}
              </div>
            ))}
          </div>
        </Box>
      )}

      <Div label="Formats supportés"/>
      <Box>
        <div style={{padding:14,...M,fontSize:"0.63rem",color:C.tx2,lineHeight:2.1}}>
          <strong style={{color:C.acc}}>JSON</strong> — Format natif : <span style={{color:C.tx}}>{`{"accounts": [{...}]}`}</span><br/>
          <strong style={{color:C.acc}}>BoursoBank</strong> — Copier-coller direct depuis l'interface web (tableau ou texte)<br/>
          <strong style={{color:C.acc}}>Natixis / Amundi</strong> — Tableau positions avec ISIN, quantités, valorisations<br/>
          <strong style={{color:C.acc}}>Texte libre</strong> — Toute donnée contenant des ISIN, montants, % de perf<br/>
          <br/>
          <span style={{color:C.mut2}}>Champs détectés : ISIN, type de compte, valorisation totale, PnL latent/fiscal, SRRI, perf 1an</span>
        </div>
      </Box>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════════
const SK = "pat_v4"
const load = () => {try{const r=localStorage.getItem(SK);return r?JSON.parse(r):null}catch{return null}}
const persist = d => {try{localStorage.setItem(SK,JSON.stringify(d))}catch{}}

// ═══════════════════════════════════════════════════════════════════
// INITIAL DATA
// ═══════════════════════════════════════════════════════════════════
const INIT = {
  profiles:[{
    id:"bastien", name:"Bastien", riskProfile:"dynamique", color:C.acc,
    snapshots:[{date:"2026-02-28", accounts:[
      {id:"pea",name:"PEA BoursoBank",type:"PEA",institution:{name:"BoursoBank"},totalValue:6348.80,cashBalance:8.51,securitiesValue:6340.29,unrealizedPnL:-24.67,unrealizedPnLPercent:-0.39,totalContributed:6086.57,
       holdings:[
        {id:"h1",name:"Hermès International",isin:"FR0000052292",assetClass:"EQUITIES",geography:["FRANCE"],quantity:1,currentValue:2049,unrealizedPnL:-345.36,unrealizedPnLPercent:-14.42},
        {id:"h2",name:"Amundi S&P 500 ETF",isin:"FR0011871128",assetClass:"EQUITIES",geography:["US"],quantity:18,currentValue:916.72,unrealizedPnL:40.11,unrealizedPnLPercent:4.58},
        {id:"h3",name:"Amundi Emerging Asia ETF",isin:"FR0013412012",assetClass:"EQUITIES",geography:["EMERGING_ASIA"],quantity:21,currentValue:724.16,unrealizedPnL:49.54,unrealizedPnLPercent:7.34},
        {id:"h4",name:"Amundi NASDAQ-100 ETF",isin:"FR0011871110",assetClass:"EQUITIES",geography:["US"],quantity:7,currentValue:592.83,unrealizedPnL:12.16,unrealizedPnLPercent:2.09},
        {id:"h5",name:"LVMH",isin:"FR0000121014",assetClass:"EQUITIES",geography:["FRANCE"],quantity:1,currentValue:544.10,unrealizedPnL:35.36,unrealizedPnLPercent:6.95},
        {id:"h6",name:"Air Liquide",isin:"FR0000120073",assetClass:"EQUITIES",geography:["FRANCE"],quantity:2,currentValue:356.48,unrealizedPnL:21.25,unrealizedPnLPercent:6.34},
        {id:"h7",name:"Dassault Aviation",isin:"FR0014004L86",assetClass:"EQUITIES",geography:["FRANCE"],quantity:1,currentValue:338.60,unrealizedPnL:34.69,unrealizedPnLPercent:11.41},
        {id:"h8",name:"TotalEnergies",isin:"FR0000120271",assetClass:"EQUITIES",geography:["FRANCE"],quantity:5,currentValue:336.40,unrealizedPnL:70.84,unrealizedPnLPercent:26.68},
        {id:"h9",name:"Amundi MSCI World ETF",isin:"FR001400U5Q4",assetClass:"EQUITIES",geography:["US","EUROPE","JAPAN"],quantity:54,currentValue:297.76,unrealizedPnL:13.40,unrealizedPnLPercent:4.71},
        {id:"h10",name:"Airbus",isin:"NL0000235190",assetClass:"EQUITIES",geography:["EUROPE"],quantity:1,currentValue:184.24,unrealizedPnL:43.34,unrealizedPnLPercent:30.76},
      ]},
      {id:"cto",name:"CTO BoursoBank",type:"CTO",institution:{name:"BoursoBank"},totalValue:112.25,cashBalance:0,securitiesValue:112.25,unrealizedPnL:-104.33,unrealizedPnLPercent:-48.17,
       holdings:[
        {id:"c1",name:"IonQ",isin:"US46222L1089",ticker:"IONQ",assetClass:"EQUITIES",geography:["US"],quantity:3,currentValue:97.50,unrealizedPnL:-74.81,unrealizedPnLPercent:-43.42},
        {id:"c2",name:"Rigetti Computing",isin:"US76655K1034",ticker:"RGTI",assetClass:"EQUITIES",geography:["US"],quantity:1,currentValue:14.76,unrealizedPnL:-29.52,unrealizedPnLPercent:-66.67},
      ]},
      {id:"liv",name:"Livret A BoursoBank",type:"LIVRET_A",institution:{name:"BoursoBank"},totalValue:707,cashBalance:707,securitiesValue:0,holdings:[{id:"la",name:"Livret A",assetClass:"CASH",geography:["FRANCE"],quantity:707,currentValue:707}]},
      {id:"av",name:"LCL Vie",type:"AV",institution:{name:"LCL"},totalValue:34218.64,cashBalance:0,securitiesValue:34218.64,unrealizedPnL:1775.86,unrealizedPnLPercent:5.48,
       holdings:[
        {id:"av1",name:"Support Euro LCL Vie",assetClass:"BONDS",geography:["UNKNOWN"],quantity:1,currentValue:23606.42,unrealizedPnL:936.86,unrealizedPnLPercent:4.13},
        {id:"av2",name:"LCL Équilibre ETF Select",isin:"FR0010833715",assetClass:"MIXED",geography:["US","EUROPE"],quantity:54.8,currentValue:10572.76,unrealizedPnL:839,unrealizedPnLPercent:8.62},
      ]},
      {id:"perco",name:"PERCO Natixis",type:"PERCO",institution:{name:"Natixis"},totalValue:1335.48,cashBalance:0,securitiesValue:1335.48,unrealizedPnL:32.49,unrealizedPnLPercent:2.49,
       holdings:[
        {id:"pc1",name:"Expertise ESG Équilibre I",assetClass:"MIXED",geography:["EUROPE","GLOBAL"],quantity:3.74,currentValue:403.44,perf1y:3.21,riskLevel:3},
        {id:"pc2",name:"Avenir Actions Europe I",assetClass:"EQUITIES",geography:["EUROPE"],quantity:5.87,currentValue:276.65,perf1y:6.16,riskLevel:5},
        {id:"pc3",name:"DNCA Sérénité Plus I",assetClass:"MIXED",geography:["EUROPE"],quantity:51.08,currentValue:262.58,perf1y:0.76,riskLevel:3},
        {id:"pc4",name:"Mirova Actions Intl I",assetClass:"EQUITIES",geography:["GLOBAL"],quantity:6.99,currentValue:262.03,perf1y:0.55,riskLevel:5},
        {id:"pc5",name:"ISR Monétaire I",assetClass:"MONEY_MARKET",geography:["EUROPE"],quantity:6.74,currentValue:130.79,perf1y:0.38,riskLevel:1},
      ]},
      {id:"pee_n",name:"PEE Natixis",type:"PEE",institution:{name:"Natixis"},totalValue:3193.61,cashBalance:0,securitiesValue:3193.61,unrealizedPnL:102.08,unrealizedPnLPercent:3.30,
       holdings:[
        {id:"pn1",name:"Mirova Actions Intl I",assetClass:"EQUITIES",geography:["GLOBAL"],quantity:24.86,currentValue:931.78,perf1y:0.55,riskLevel:5},
        {id:"pn2",name:"Expertise ESG Équilibre I",assetClass:"MIXED",geography:["EUROPE","GLOBAL"],quantity:7.38,currentValue:795.77,perf1y:3.21,riskLevel:3},
        {id:"pn3",name:"Avenir Actions Europe I",assetClass:"EQUITIES",geography:["EUROPE"],quantity:13.78,currentValue:649.29,perf1y:6.16,riskLevel:5},
        {id:"pn4",name:"Expertise ESG Dynamique I",assetClass:"EQUITIES",geography:["EUROPE","GLOBAL"],quantity:2.54,currentValue:339.34,perf1y:10.30,riskLevel:4},
        {id:"pn5",name:"DNCA Sérénité Plus I",assetClass:"MIXED",geography:["EUROPE"],quantity:60.31,currentValue:310.00,perf1y:0.76,riskLevel:3},
        {id:"pn6",name:"ISR Monétaire I",assetClass:"MONEY_MARKET",geography:["EUROPE"],quantity:8.63,currentValue:167.44,perf1y:0.38,riskLevel:1},
      ]},
      {id:"crypto",name:"Binance Wallet",type:"CRYPTO",institution:{name:"Binance"},totalValue:1280.43,cashBalance:84.54,securitiesValue:1195.89,
       holdings:[
        {id:"bt",name:"Bitcoin",ticker:"BTC",assetClass:"CRYPTO",geography:["CRYPTO_GLOBAL"],quantity:0.0121236,currentValue:659},
        {id:"et",name:"Ethereum",ticker:"ETH",assetClass:"CRYPTO",geography:["CRYPTO_GLOBAL"],quantity:0.27461,currentValue:436.27},
        {id:"uc",name:"USDC",ticker:"USDC",assetClass:"CASH",geography:["CRYPTO_GLOBAL"],quantity:5.28845,currentValue:84.49},
        {id:"sl",name:"Solana",ticker:"SOL",assetClass:"CRYPTO",geography:["CRYPTO_GLOBAL"],quantity:1.214184,currentValue:81.56},
        {id:"bn",name:"BNB",ticker:"BNB",assetClass:"CRYPTO",geography:["CRYPTO_GLOBAL"],quantity:0.037633,currentValue:19.06},
      ]},
      {id:"pee_a",name:"PEE Amundi DS",type:"PEE",institution:{name:"Amundi"},totalValue:8293.26,cashBalance:0,securitiesValue:8293.26,fiscalPnL:677.93,
       holdings:[
        {id:"pa1",name:"DS Actions Monde",assetClass:"EQUITIES",geography:["GLOBAL"],quantity:205.89,currentValue:3028.70,fiscalPnL:458.50,perf1y:10.77,riskLevel:4},
        {id:"pa2",name:"DS ISR Dynamique",assetClass:"MIXED",geography:["GLOBAL"],quantity:49.37,currentValue:1697.18,fiscalPnL:81.73,perf1y:0.76,riskLevel:3},
        {id:"pa3",name:"DS ISR Équilibre",assetClass:"MIXED",geography:["GLOBAL"],quantity:148.37,currentValue:1579.69,fiscalPnL:78.66,perf1y:1.49,riskLevel:3},
        {id:"pa4",name:"DS ISR Modéré",assetClass:"MIXED",geography:["GLOBAL"],quantity:99.24,currentValue:1000.65,fiscalPnL:53.25,perf1y:4.20,riskLevel:2},
        {id:"pa5",name:"Together Multiple 2025",assetClass:"MIXED",geography:["FRANCE"],quantity:26.08,currentValue:735.39,riskLevel:3},
        {id:"pa6",name:"Label Monétaire ESR",assetClass:"MONEY_MARKET",geography:["EUROPE"],quantity:0.19,currentValue:251.65,fiscalPnL:5.79,perf1y:2.03,riskLevel:1},
      ]},
      {id:"per",name:"PER COL Amundi DS",type:"PERCOL",institution:{name:"Amundi"},totalValue:5041.13,cashBalance:0,securitiesValue:5041.13,fiscalPnL:472.93,
       holdings:[{id:"po1",name:"Amundi Convictions ESR",assetClass:"EQUITIES",geography:["GLOBAL"],quantity:23.39,currentValue:5041.13,fiscalPnL:472.93,perf1y:7.72,riskLevel:4}]},
    ]}]
  }],
  lastUpdated:"2026-02-28"
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════
function Dashboard({profile,snapshots}) {
  const last = snapshots[snapshots.length-1]
  const accounts = last?.accounts||[]
  const tv = accounts.reduce((s,a)=>s+(a.totalValue||0),0)
  const pnl = accounts.reduce((s,a)=>s+(a.unrealizedPnL||a.fiscalPnL||0),0)
  const assets = useMemo(()=>assetBreakdown(accounts),[accounts])
  const geo = useMemo(()=>geoExposure(accounts),[accounts])
  const metrics = useMemo(()=>perfMetrics(snapshots)||{tv,pnl,pnlPct:null,ytd:null,cagr:null,xirr:null},[snapshots,tv,pnl])
  const alerts = useMemo(()=>computeAlerts(profile,accounts,geo,assets,tv),[profile,accounts,geo,assets,tv])

  return (
    <div style={{maxWidth:1440,margin:"0 auto",padding:"0 20px 48px"}}>
      {/* Header */}
      <header style={{padding:"22px 0 16px",borderBottom:`1px solid ${C.b0}`,display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:4}}>
        <div>
          <h1 style={{...S,fontSize:"1.9rem",color:C.tx,letterSpacing:"-0.02em",lineHeight:1,marginBottom:8}}>
            Patrimoine <span style={{color:profile.color}}>{profile.name}</span>
          </h1>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <Tag c={C.mut3}>{accounts.length} comptes</Tag>
            <Tag c={C.mut3}>{last?.date||"—"}</Tag>
            <Tag c={profile.color}>profil {profile.riskProfile}</Tag>
            {alerts.filter(a=>a.lvl==="danger").length>0&&
              <Tag c={C.red}>{alerts.filter(a=>a.lvl==="danger").length} alerte(s) critique(s)</Tag>}
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{...M,fontSize:"0.56rem",color:C.mut2,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:5}}>Total patrimoine</div>
          <div style={{...S,fontSize:"2.5rem",color:C.acc2,letterSpacing:"-0.02em",lineHeight:1}}>{f$(tv)}</div>
          <div style={{...M,fontSize:"0.7rem",marginTop:5,color:pnl?pc(pnl):C.mut2}}>
            {pnl?`${pnl>=0?"+":""}${f$(pnl,true)} latent`:"Ajouter totalContributed pour le PnL global"}
          </div>
        </div>
      </header>

      {/* KPI strip */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:1,background:C.b0,borderRadius:7,overflow:"hidden",margin:"14px 0 20px"}}>
        {[
          {l:"Actions (PEA+CTO)",v:f$(accounts.filter(a=>["PEA","CTO"].includes(a.type)).reduce((s,a)=>s+a.totalValue,0),true),s:`${((accounts.filter(a=>["PEA","CTO"].includes(a.type)).reduce((s,a)=>s+a.totalValue,0)/tv)*100).toFixed(1)}%`},
          {l:"Assurance Vie",v:f$(accounts.filter(a=>a.type==="AV").reduce((s,a)=>s+a.totalValue,0),true),s:"LCL Vie"},
          {l:"Épargne salariale",v:f$(accounts.filter(a=>["PEE","PERCO","PERCOL"].includes(a.type)).reduce((s,a)=>s+a.totalValue,0),true),s:"Bloquée (DS)"},
          {l:"Crypto",v:f$(accounts.filter(a=>a.type==="CRYPTO").reduce((s,a)=>s+a.totalValue,0),true),s:"Binance live"},
          {l:"Liquidités",v:f$(accounts.filter(a=>a.type==="LIVRET_A").reduce((s,a)=>s+a.totalValue,0)+accounts.reduce((s,a)=>s+(a.cashBalance||0),0),true),s:"Livret A + espèces"},
        ].map((k,i)=>(
          <div key={i} style={{background:C.s1,padding:"12px 14px"}}>
            <div style={{...M,fontSize:"0.55rem",color:C.mut2,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:5}}>{k.l}</div>
            <div style={{...S,fontSize:"1.25rem",color:C.acc2,lineHeight:1}}>{k.v}</div>
            <div style={{...M,fontSize:"0.59rem",color:C.mut2,marginTop:3}}>{k.s}</div>
          </div>
        ))}
      </div>

      {alerts.length>0&&<><Div label="Alertes"/><AlertsPanel alerts={alerts}/></>}
      <Div label="Performance consolidée"/>
      <PerfModule metrics={metrics} snapshots={snapshots}/>
      <Div label="Répartition & exposition"/>
      <ChartsRow accounts={accounts} tv={tv} assets={assets} geo={geo}/>
      <Div label="Géographie détaillée"/>
      <GeoBar geo={geo}/>
      <Div label="Simulateur what-if"/>
      <Simulator accounts={accounts} tv={tv}/>
      <Div label="Rééquilibrage"/>
      <RebalancingPanel profile={profile} accounts={accounts} assets={assets} tv={tv}/>
      <Div label="Allocation cible"/>
      <AllocTable profile={profile} assets={assets} tv={tv}/>
      <Div label="Positions (triables)"/>
      <HoldingsTable accounts={accounts}/>
      <Div label="Comptes"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
        {accounts.map(acc=>{
          const col=C.cMap[acc.type]||C.mut3
          const apnl=acc.unrealizedPnL??acc.fiscalPnL
          return(
            <div key={acc.id} style={{background:C.s2,border:`1px solid ${C.b0}`,borderRadius:8,borderTopColor:col,borderTopWidth:3,padding:14}}>
              <div style={{...M,fontSize:"0.56rem",color:col,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3}}>{acc.institution?.name} · {ACC_NAME[acc.type]||acc.type}</div>
              <div style={{fontSize:"0.8rem",fontWeight:600,color:C.tx,marginBottom:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{acc.name}</div>
              <div style={{...S,fontSize:"1.35rem",color:C.acc2,marginBottom:4}}>{f$(acc.totalValue)}</div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{...M,fontSize:"0.64rem",color:apnl!=null?pc(apnl):C.mut2}}>
                  {apnl!=null?`${apnl>=0?"+":""}${f$(apnl,true)} ${acc.unrealizedPnLPercent?`(${fp(acc.unrealizedPnLPercent)})`:""}` : "—"}
                </span>
                <span style={{...M,fontSize:"0.59rem",color:C.mut2}}>{((acc.totalValue/tv)*100).toFixed(1)}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════════════
export default function App() {
  const [data,setData] = useState(null)
  const [pid,setPid] = useState(null)
  const [page,setPage] = useState("dashboard")

  useEffect(()=>{
    const d = load()||INIT
    setData(d); setPid(d.profiles[0]?.id)
  },[])

  const addProfile = () => {
    const name = prompt("Nom du profil (ex: Papa)")
    if(!name) return
    setData(prev=>{
      const np={id:name.toLowerCase().replace(/\s+/g,"-"),name,riskProfile:"modéré",
        color:[C.amb,C.pur,C.blu2,C.tel][prev.profiles.length%4],snapshots:[]}
      const u={...prev,profiles:[...prev.profiles,np]}; persist(u); return u
    })
  }

  const onImport = useCallback((profileId, importedAccounts) => {
    setData(prev=>{
      const profiles = prev.profiles.map(p=>{
        if(p.id!==profileId) return p
        const snaps = p.snapshots||[]
        const lastSnap = snaps[snaps.length-1]

        // Merger: conserver les comptes non importés, remplacer ceux qui sont dans l'import
        let mergedAccounts
        if(lastSnap?.accounts?.length) {
          const importedByKey = {}
          for(const acc of importedAccounts) {
            const key = acc.type + '|' + (acc.institution?.name||'')
            importedByKey[key] = acc
          }
          // Remplacer les comptes existants si présents dans l'import, sinon garder
          const updated = lastSnap.accounts.map(oldAcc => {
            const key = oldAcc.type + '|' + (oldAcc.institution?.name||'')
            return importedByKey[key] ? {...importedByKey[key], _updated:true} : oldAcc
          })
          // Ajouter les comptes tout neufs (pas encore dans le snapshot précédent)
          const oldKeys = new Set(lastSnap.accounts.map(a=>a.type+'|'+(a.institution?.name||'')))
          const brandNew = importedAccounts.filter(a => !oldKeys.has(a.type+'|'+(a.institution?.name||'')))
          mergedAccounts = [...updated, ...brandNew]
        } else {
          mergedAccounts = importedAccounts
        }

        const snap = {date:new Date().toISOString().split("T")[0], accounts:mergedAccounts}
        return{...p, snapshots:[...snaps, snap]}
      })
      const u={...prev,profiles,lastUpdated:new Date().toISOString()}; persist(u); return u
    })
    setPage("dashboard")
  },[])

  if(!data) return <div style={{background:C.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",...M,color:C.mut2}}>chargement…</div>

  const profile = data.profiles.find(p=>p.id===pid)||data.profiles[0]

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.tx,fontFamily:"system-ui,sans-serif"}}>
      {/* Grid texture */}
      <div style={{position:"fixed",inset:0,backgroundImage:`linear-gradient(${C.b0}50 1px,transparent 1px),linear-gradient(90deg,${C.b0}50 1px,transparent 1px)`,backgroundSize:"28px 28px",pointerEvents:"none",zIndex:0,opacity:0.7}}/>

      {/* Nav */}
      <nav style={{position:"sticky",top:0,zIndex:50,background:`${C.s0}f0`,backdropFilter:"blur(16px)",borderBottom:`1px solid ${C.b0}`}}>
        <div style={{maxWidth:1440,margin:"0 auto",padding:"0 20px",height:46,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:18,height:18,borderRadius:4,background:`${C.acc}18`,border:`1px solid ${C.acc}30`,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:C.acc,boxShadow:`0 0 6px ${C.acc}`}}/>
            </div>
            <span style={{...S,fontSize:"0.88rem",color:C.tx}}>Patrimoine</span>
          </div>
          <div style={{display:"flex",gap:3,alignItems:"center"}}>
            {data.profiles.map(p=>(
              <button key={p.id} onClick={()=>{setPid(p.id);setPage("dashboard")}}
                style={{...M,padding:"4px 11px",borderRadius:4,border:`1px solid ${pid===p.id?p.color:C.b1}`,background:pid===p.id?`${p.color}18`:"none",color:pid===p.id?p.color:C.mut2,fontSize:"0.66rem",cursor:"pointer"}}>
                {p.name}
              </button>
            ))}
            <button onClick={addProfile} style={{...M,padding:"4px 9px",borderRadius:4,border:`1px solid ${C.b1}`,background:"none",color:C.mut2,fontSize:"0.66rem",cursor:"pointer"}}>+ Profil</button>
          </div>
          <div style={{display:"flex",gap:2}}>
            {[["dashboard","Dashboard"],["import","Import"]].map(([p,l])=>(
              <button key={p} onClick={()=>setPage(p)} style={{...M,padding:"4px 11px",borderRadius:4,border:"none",background:page===p?`${C.acc}12`:"none",color:page===p?C.acc:C.mut2,fontSize:"0.66rem",cursor:"pointer",letterSpacing:"0.04em"}}>{l}</button>
            ))}
          </div>
        </div>
      </nav>

      <div style={{position:"relative",zIndex:1}}>
        {page==="import"
          ? <ImportPage profiles={data.profiles} onImport={onImport}/>
          : <Dashboard profile={profile} snapshots={profile?.snapshots||[]}/>
        }
      </div>
    </div>
  )
}
