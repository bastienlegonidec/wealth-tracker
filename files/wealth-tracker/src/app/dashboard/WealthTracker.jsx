import { useState, useEffect, useMemo, useCallback } from "react"
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar,
} from "recharts"

// ═══════════════════════════════════════════════════════════════════
// DESIGN SYSTEM
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
    "États-Unis":"#4a90e8", Europe:"#7dc830", France:"#1a9870",
    "Asie émergente":"#c88018", Japon:"#c86028",
    "Monde diversifié":"#9040c0", "Crypto (mondial)":"#d4c820", "Non géolocalisé":"#2e4226",
  },
}

const M = {fontFamily:"'Courier New',Courier,monospace"}
const S = {fontFamily:"Georgia,'Times New Roman',serif"}

const ETF_GEO = {
  "FR0011871128": {US:98,Europe:2},
  "FR0011871110": {US:98,Europe:2},
  "FR001400U5Q4": {US:65,Europe:15,Japon:7,"Asie émergente":5,"Monde diversifié":8},
  "FR0013412012": {"Asie émergente":78,"Monde diversifié":15,"Non géolocalisé":7},
  "FR0010833715": {US:40,Europe:45,"Monde diversifié":15},
}

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

function geoExposure(accounts) {
  const m = {}
  const add = (zone, val) => { m[zone] = (m[zone]||0) + val }
  for (const acc of accounts) {
    for (const h of (acc.holdings||[])) {
      const weights = h.isin && ETF_GEO[h.isin]
      if (weights) {
        for (const [z, pct] of Object.entries(weights)) add(z, h.currentValue * pct / 100)
      } else {
        for (const z of (h.geography||["UNKNOWN"])) {
          const name = GEO_NAME[z] || z
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
  // FIX: utiliser uniquement le dernier snapshot pour éviter les doublons dus aux imports
  const last = snapshots[snapshots.length-1]
  const tv = last.accounts.reduce((s,a)=>s+(a.totalValue||0),0)
  const tc = last.accounts.reduce((s,a)=>s+(a.totalContributed||0),0)
  const pnl = last.accounts.reduce((s,a)=>s+(a.unrealizedPnL||a.fiscalPnL||0),0)

  // YTD: comparer avec le premier snapshot de l'année courante
  const yr = new Date().getFullYear()
  // FIX: dédupliquer les snapshots par date avant calcul
  const uniqueSnaps = []
  const seenDates = new Set()
  for (const s of snapshots) {
    if (!seenDates.has(s.date)) { seenDates.add(s.date); uniqueSnaps.push(s) }
  }
  const ytdS = uniqueSnaps.find(s=>s.date.startsWith(String(yr)))||uniqueSnaps[0]
  const ytdV = ytdS.accounts.reduce((s,a)=>s+(a.totalValue||0),0)
  const ytd = ytdV>0?((tv-ytdV)/ytdV)*100:0

  // CAGR sur snapshots uniques seulement
  const first = uniqueSnaps[0]
  const years = (new Date(last.date)-new Date(first.date))/(365.25*864e5)
  const fv = first.accounts.reduce((s,a)=>s+(a.totalValue||0),0)
  const cagr = years>0.1&&fv>0?(Math.pow(tv/fv,1/years)-1)*100:null

  // XIRR: utiliser uniquement les snapshots uniques ET seulement si on a totalContributed fiable
  const hasTc = last.accounts.some(a=>a.totalContributed>0)
  let xIRR = null
  if (hasTc && uniqueSnaps.length >= 2) {
    const cfs = []
    if(fv>0) cfs.push({date:first.date,amount:-fv})
    for(let i=0;i<uniqueSnaps.length-1;i++){
      const a=uniqueSnaps[i].accounts.reduce((s,a)=>s+(a.totalContributed||0),0)
      const b=uniqueSnaps[i+1].accounts.reduce((s,a)=>s+(a.totalContributed||0),0)
      const d=b-a; if(Math.abs(d)>10) cfs.push({date:uniqueSnaps[i+1].date,amount:-d})
    }
    cfs.push({date:last.date,amount:tv})
    xIRR = cfs.length>=2?xirr(cfs):null
    // FIX: valeur aberrante si pas assez de données temporelles
    if (xIRR && (xIRR < -50 || xIRR > 200)) xIRR = null
  }

  return {tv,tc,pnl,pnlPct:tc>0?((tv-tc)/tc)*100:null,ytd,cagr,xirr:xIRR}
}

// ═══════════════════════════════════════════════════════════════════
// SMART IMPORT PARSER — v4 (fix noms corrompus + merge clé améliorée)
// ═══════════════════════════════════════════════════════════════════

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

// FIX: normalisation plus prudente — ne remplacer "A\nV" que si c'est vraiment un bouton UI
// En évitant de corrompre les noms de positions qui commencent par une lettre
function normalizeRaw(text) {
  // Remplacer uniquement les occurrences isolées de "A" suivi de sauts de ligne puis "V"
  // Contexte: bouton UI BoursoBank "AV" (Alerte/Vue) sur sa propre ligne
  return text
    .replace(/^A\s*\n+\s*V$/gm, 'AV')   // lignes isolées "A" puis "V"
    .replace(/\bA\s{2,}V\b/g, 'AV')       // A   V avec espaces multiples
}

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

const NOISE_RE = /^(\*|accéder|imprimer|exporter|guide|gestion libre|mes listes|mise au nominatif|actus|assemblées|tarification|fiscalité|mouvements|documents|ordres|performance$|positions.?rubrique|les données|besoin d|je découvre|pour optimis|chez bourso|le contrat|répartition de l|voir l.évolution|plafond de versement|mode de gestion|date d.ouverture|decouverte|valeurquantit|besoin|télécharge|quelle est|j.actualise|engagements en|valeurs éligibles|dates de liquid|mode d.emploi|couverture|total \+\/- val|total des \+\/- val|positions au comptant|total portefeuille|solde espèces|évaluation des|intérêts acquis|intérêts en cours|plafond \(hors|taux de rémun|date d.ouverture|solde au|répartition de l.invest)/i

const GEO_NOISE_RE = /^(amérique du nord|amérique du sud|europe|asie.océanie|afrique|moyen orient|autres|les données de répartition)/i

const PERF_LINE_RE = /^([+\-]?\d+[,.]\d+\s*%|ma performance|performance.*cac|performance.*top|performance.*veille|performance.*mars|performance.*202)/i

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/

const ACC_DEFS = [
  {re:/wallet.?binance|^binance$/i,                          type:'CRYPTO',   inst:'Binance'},
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
  if (/^\d{5,}/.test(line)) return null
  if (DATE_RE.test(line)) return null
  return ACC_DEFS.find(d => d.re.test(line)) || null
}

function parseBinanceLine(text) {
  const TICKERS = ['BTC','ETH','BNB','SOL','USDC','USDT','BUSD','EUR','ADA','DOT','MATIC','AVAX','LINK']
  const STABLES = ['USDC','USDT','BUSD']
  const NAMES = {BTC:'Bitcoin',ETH:'Ethereum',BNB:'BNB',SOL:'Solana',
                 USDC:'USD Coin',USDT:'Tether',EUR:'EUR Binance',ADA:'Cardano'}
  const results = []

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
      const volDec = afterDot.slice(0, 6)
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

// FIX: nettoyage renforcé des noms de positions
// Supprime les résidus "V " en début de nom causés par la normalisation AV
function cleanHoldingName(raw) {
  if (!raw) return raw
  return raw
    .replace(/^(AV\s+|V\s+|A\s+V\s+)/i, '')  // résidus "AV ", "V ", "A V " en début
    .replace(/\s+/g, ' ')
    .trim()
}

function parsePEABlock(blockLines) {
  const joined = blockLines.join(' ')
  const avCount = (joined.match(/\bAV\b/g)||[]).length
  const isinCount = (joined.match(/[A-Z]{2}[A-Z0-9]{10}/g)||[]).length
  if (avCount >= 2 && isinCount >= 2 && blockLines.length < avCount * 4) {
    return parsePEAInline(joined)
  }
  return parsePEAMultiline(blockLines)
}

function parsePEAInline(text) {
  const holdings = []
  const parts = text.split(/\bAV\b/).slice(1)
  for (const part of parts) {
    const p = part.trim()
    const isinM = p.match(/\b([A-Z]{2}[A-Z0-9]{10})\b/)
    if (!isinM) continue
    const isin = isinM[1]
    const isinPos = p.indexOf(isin)
    // FIX: nettoyer le nom après extraction
    const rawName = p.slice(0, isinPos).replace(/Ass\.?\s*Gén\.?/g,'').replace(/\s+/g,' ').trim()
    const name = cleanHoldingName(rawName)
    const after = p.slice(isinPos + 12).trim()
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

function parsePEAMultiline(blockLines) {
  const holdings = []
  let i = 0
  while (i < blockLines.length) {
    const l = blockLines[i]
    // FIX: ignorer les résidus "AV", "V", "A", "Ass. Gén." isolés
    if (/^(AV|V|A|Ass\.?\s*Gén\.?)$/i.test(l)) { i++; continue }
    if (NOISE_RE.test(l) || GEO_NOISE_RE.test(l) || DATE_RE.test(l)) { i++; continue }
    const win = blockLines.slice(i, i + 6)
    const isinIdx = win.findIndex(x => /^[A-Z]{2}[A-Z0-9]{10}$/.test(x))
    if (isinIdx < 0) { i++; continue }
    // FIX: nettoyer chaque segment de nom avant de joindre
    const rawName = win.slice(0, isinIdx)
      .filter(x => !/^(AV|V|A|Ass\.?\s*Gén\.?)$/i.test(x))
      .join(' ').trim()
    const name = cleanHoldingName(rawName)
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

function parseAVCompact(line) {
  const holdings = []
  const headerIdx = line.search(/SUPPORT\s*EURO/i)
  const body = headerIdx >= 0 ? line.slice(headerIdx) : line
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

function parseAVTable(lines) {
  const holdings = []
  let i = 0
  while (i < lines.length) {
    const l = lines[i]
    if (NOISE_RE.test(l) || GEO_NOISE_RE.test(l) || DATE_RE.test(l)) { i++; continue }
    if (/^[-–]$/.test(l)) { i++; continue }
    if (/^[A-ZÉÈÀÙ]/.test(l) && !DATE_RE.test(l) && !/^[A-Z]{2}[A-Z0-9]{10}$/.test(l) && l.length > 5) {
      const name = l
      const nextLines = lines.slice(i+1, i+12)
      let dataLine = null
      let skipOffset = 1
      for (let k = 0; k < nextLines.length; k++) {
        const nl = nextLines[k]
        if (DATE_RE.test(nl) || /^[-–]$/.test(nl) || NOISE_RE.test(nl)) { skipOffset = k+2; continue }
        if (nl.includes('\t') && (parseEUR(nl) !== null || parsePCT(nl) !== null)) {
          dataLine = nl; skipOffset = k + 2; break
        }
        if (/^\d+[.,]\d+$/.test(nl) || /^\d+$/.test(nl)) {
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

function parseImport(raw) {
  try {
    const p = JSON.parse(raw)
    if (p.accounts) return {accounts:p.accounts, source:'json'}
    if (Array.isArray(p)) return {accounts:p, source:'json'}
  } catch {}

  const normalized = normalizeRaw(raw)
  const today = new Date().toISOString().split('T')[0]
  const lines = normalized.split(/\n/).map(l=>l.trim()).filter(l=>l.length>0)

  const accounts = []
  let curAcc = null
  let mode = 'none'
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
    // FIX: recalculer unrealizedPnL du compte depuis les holdings si absent
    if (!curAcc.unrealizedPnL && curAcc.holdings.length > 0) {
      const sum = curAcc.holdings.reduce((s,h)=>s+(h.unrealizedPnL||0), 0)
      if (sum !== 0) curAcc.unrealizedPnL = sum
    }
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

    if (mode==='binance') {
      if (/DEVISE\s*\t|VOLUME\s*\t/i.test(l)) { mode='binance_table'; binanceBuffer=l+'\n'; continue }
      if (mode==='binance_table'||binanceBuffer) { binanceBuffer+=l+'\n'; continue }
      if (/DEVISEVOLUME|BTC\d|ETH\d/i.test(l)) {
        curAcc.holdings=parseBinanceLine(l)
        if(!curAcc.totalValue&&curAcc.holdings.length)
          curAcc.totalValue=curAcc.holdings.reduce((s,h)=>s+h.currentValue,0)
      }
      continue
    }
    if (mode==='binance_table') { binanceBuffer+=l+'\n'; continue }

    if (mode==='av') {
      if (/VALEURDATE|SUPPORT\s*EURO/i.test(l)) {
        curAcc.holdings=parseAVCompact(l)
      } else if (/VALEUR\s*\t.*DATE/i.test(l)) {
        mode='natixis'
      }
      continue
    }

    if (mode==='natixis') {
      if (NOISE_RE.test(l)||GEO_NOISE_RE.test(l)) continue
      blockLines.push(l)
      continue
    }

    if (mode==='pea_cto') {
      if (/valeurquantit|valeur\s*\n?\s*quantit/i.test(l)) { blockLines=[]; continue }
      if (PERF_LINE_RE.test(l)) continue
      blockLines.push(l)
    }
  }

  flushAcc()

  // Déduplication
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
// MERGE AMÉLIORÉ — clé stable pour distinguer PEE Natixis vs PEE Amundi
// ═══════════════════════════════════════════════════════════════════

/**
 * Calcule une clé de merge stable pour un compte.
 * FIX: utilise l'id natif ou une combinaison type+institution+nom
 * pour éviter la fusion de PEE Natixis et PEE Amundi (même type, institution différente)
 */
function mergeKey(acc) {
  // Priorité 1: id natif du portfolio.json (toujours stable)
  if (acc.id && !acc.id.includes('-'+Date.now().toString().slice(0,8))) {
    // id natif (pas généré par le parser qui ajoute Date.now())
    if (!/^\w+-(pea|cto|pee|perco|percol|crypto|livret|av)-\d{13}/.test(acc.id)) {
      return acc.id
    }
  }
  // Priorité 2: type + institution (distingue PEE Natixis vs PEE Amundi)
  return acc.type + '|' + (acc.institution?.name || acc.institutionId || '')
}

// ═══════════════════════════════════════════════════════════════════
// ALERTS ENGINE
// ═══════════════════════════════════════════════════════════════════
function computeAlerts(profile, accounts, geo, assets, tv) {
  const alerts = []
  const gm = Object.fromEntries(geo.map(g=>[g.zone,g.percent]))
  const am = Object.fromEntries(assets.map(a=>[a.label,a.percent]))
  const tgt = TARGETS[profile.riskProfile]||TARGETS.dynamique

  const usExp = (gm["États-Unis"]||0)
  if (usExp>58) alerts.push({
    lvl:"danger",icon:"🔴",cat:"Géographie",
    title:`Surexposition US : ${usExp.toFixed(0)}%`,
    detail:`${usExp.toFixed(1)}% d'exposition réelle aux États-Unis. Seuil conseillé : <58%.`,
    action:"→ Renforcer sur Amundi MSCI EM (FR0010959676) ou iShares MSCI Europe",
    metric:`${usExp.toFixed(0)}%`,
  })

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

  const pea = accounts.find(a=>a.type==="PEA")
  if (pea?.totalContributed && 150000-pea.totalContributed>5000) alerts.push({
    lvl:"info",icon:"✦",cat:"Fiscal",
    title:`PEA : ${f$(150000-pea.totalContributed,true)} disponible`,
    detail:`Plafond versements PEA non atteint. Enveloppe fiscalement la plus efficace sur actions.`,
    action:"→ Versements mensuels sur MSCI World ETF PEA (FR001400U5Q4)",
    metric:f$(150000-pea.totalContributed,true),
  })

  const hermes = pea?.holdings?.find(h=>h.isin==="FR0000052292")
  if (hermes && (hermes.unrealizedPnLPercent||0)<-12) alerts.push({
    lvl:"warning",icon:"⚠",cat:"Position",
    title:`Hermès −${Math.abs(hermes.unrealizedPnLPercent||0).toFixed(1)}%`,
    detail:`${f$(hermes.currentValue)} avec ${f$(hermes.unrealizedPnL)} de perte latente.`,
    action:"→ DCA si conviction long terme · ou solder pour compenser des PV CTO",
    metric:fp(hermes.unrealizedPnLPercent),
  })

  const cto = accounts.find(a=>a.type==="CTO")
  if (cto && (cto.unrealizedPnLPercent||0)<-35) alerts.push({
    lvl:"danger",icon:"🔴",cat:"Perte",
    title:`CTO : ${fp(cto.unrealizedPnLPercent)}`,
    detail:`Valeurs quantiques en forte perte. Possible optimisation fiscale PFU si soldé.`,
    action:"→ Envisager de solder IonQ/Rigetti (moins-value imputable sur PV futures)",
    metric:fp(cto.unrealizedPnLPercent),
  })

  const cryptoPct = am["Crypto-actifs"]||0
  if (cryptoPct<3 && profile.riskProfile!=="conservateur") alerts.push({
    lvl:"info",icon:"₿",cat:"Allocation",
    title:`Crypto sous-pondéré : ${cryptoPct.toFixed(1)}%`,
    detail:`Cible ${tgt["Crypto-actifs"]}% pour profil ${profile.riskProfile}.`,
    action:"→ DCA mensuel BTC sur Binance",
    metric:`${cryptoPct.toFixed(1)}%`,
  })

  return alerts.sort((a,b) => {const o={danger:0,warning:1,info:2}; return o[a.lvl]-o[b.lvl]})
}

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
// PERF MODULE
// ═══════════════════════════════════════════════════════════════════
function PerfModule({metrics,snapshots}) {
  // FIX: dédupliquer les snapshots par date pour le graphique
  const seen = new Set()
  const hist = snapshots
    .filter(s => { if(seen.has(s.date)) return false; seen.add(s.date); return true })
    .map(s=>({
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
            {l:"Performance globale",v:metrics.pnlPct!=null?fp(metrics.pnlPct):"—",c:pc(metrics.pnlPct)},
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
            <span style={{...M,fontSize:"0.62rem",color:C.mut2}}>Graphique dispo après 2+ snapshots distincts</span>
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
// CHARTS ROW
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
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,background:C.s2,borderRadius:6,padding:"10px 14px"}}>
          <span style={{...M,fontSize:"0.62rem",color:C.mut2,whiteSpace:"nowrap"}}>Apport mensuel :</span>
          <input type="range" min={0} max={5000} step={50} value={apport} onChange={e=>setApport(Number(e.target.value))} style={{flex:1,accentColor:C.acc,cursor:"pointer",height:4}}/>
          <span style={{...M,fontSize:"0.72rem",color:C.acc,minWidth:60,textAlign:"right"}}>{f$(apport,true)}</span>
        </div>
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
                <td style={{...M,padding:"8px",fontSize:"0.69rem",textAlign:"right",color:Math.abs(currentPct-targetPct)<3?C.mut2:currentPct>targetPct?C.amb2:C.blu2}}>
                  {(currentPct-targetPct)>0?"+":""}{(currentPct-targetPct).toFixed(1)}%
                </td>
                <td style={{padding:"8px",textAlign:"right"}}>
                  {Math.abs(delta)<200
                    ? <span style={{...M,fontSize:"0.63rem",color:C.mut2}}>✓ OK</span>
                    : <span style={{...M,fontSize:"0.67rem",color:delta>0?C.blu2:C.amb2,background:`${delta>0?C.blu:C.amb}12`,border:`1px solid ${delta>0?C.blu:C.amb}25`,padding:"2px 8px",borderRadius:4}}>
                        {delta>0?"↑ Renforcer":"↓ Alléger"} {f$(Math.abs(delta),true)}
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
                <span style={{color:r.delta>0?C.blu2:C.amb2}}>{r.delta>0?"↑":"↓"}</span>
                {" "}<strong>{r.cls}</strong> : {r.delta>0?"renforcer":"alléger"} <span style={{...M,color:C.tx}}>{f$(Math.abs(r.delta),true)}</span>
                <span style={{color:C.mut2}}> ({r.currentPct.toFixed(1)}% → {r.targetPct}%)</span>
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
// HOLDINGS TABLE — FIX filtres + noms
// ═══════════════════════════════════════════════════════════════════
function HoldingsTable({accounts}) {
  const [sort,setSort] = useState({k:"currentValue",d:-1})
  const [filter,setFilter] = useState("all")
  const [q,setQ] = useState("")

  const VALID_ACC_TYPES = new Set(['PEA','CTO','AV','CRYPTO','LIVRET_A','PEE','PERCO','PERCOL'])

  const all = useMemo(()=>accounts.flatMap(a=>{
    if(!VALID_ACC_TYPES.has(a.type)) return []
    return (a.holdings||[])
      .filter(h => {
        if (!h.currentValue || h.currentValue <= 0) return false
        if (!h.name) return false
        // FIX: filtre plus strict des lignes parasites
        if (/^(total port|solde|évaluation|\+\/- %|notification|valeur|quantit)/i.test(h.name)) return false
        // FIX: ignorer les holdings dont le nom est juste un ISIN (parsing raté)
        if (/^[A-Z]{2}[A-Z0-9]{10}$/.test(h.name.trim())) return false
        return true
      })
      .map(h=>({
        ...h,
        // FIX: nettoyer les noms au moment de l'affichage aussi
        name: cleanHoldingName(h.name),
        accName:a.name,
        accType:a.type,
        // FIX: distinguer PEE Natixis vs PEE Amundi dans le filtre
        accId: a.id,
        instName: a.institution?.name || a.institutionId || '',
      }))
  }),[accounts])

  // FIX: les types de filtre incluent la distinction par institution pour PEE
  // On regroupe par type mais on affiche "PEE Natixis" et "PEE Amundi" séparément si besoin
  const filterOptions = useMemo(()=>{
    const types = [...new Set(all.map(h=>h.accType).filter(t=>VALID_ACC_TYPES.has(t)))]
    // Si plusieurs PEE d'institutions différentes, créer des sous-filtres
    const peeInsts = [...new Set(all.filter(h=>h.accType==='PEE').map(h=>h.instName))]
    const result = []
    for (const t of types) {
      if (t === 'PEE' && peeInsts.length > 1) {
        for (const inst of peeInsts) {
          result.push({key: `PEE|${inst}`, label: `PEE ${inst}`, type:'PEE', inst})
        }
      } else {
        result.push({key: t, label: ACC_NAME[t]||t, type:t, inst:null})
      }
    }
    return result
  }, [all])

  const rows = useMemo(()=>{
    let r = all
    if (filter !== "all") {
      const [fType, fInst] = filter.includes('|') ? filter.split('|') : [filter, null]
      r = r.filter(h => h.accType === fType && (!fInst || h.instName === fInst))
    }
    if(q) r=r.filter(h=>(h.name||"").toLowerCase().includes(q.toLowerCase())||(h.isin||"").includes(q.toUpperCase()))
    return [...r].sort((a,b)=>{
      const av=a[sort.k]??(sort.d>0?-Infinity:Infinity)
      const bv=b[sort.k]??(sort.d>0?-Infinity:Infinity)
      return typeof av==="string"?sort.d*av.localeCompare(bv):sort.d*(bv-av)
    })
  },[all,filter,q,sort])

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
            {/* Bouton "Tout" */}
            <button onClick={()=>setFilter("all")} style={{...M,padding:"3px 8px",borderRadius:3,
              border:`1px solid ${filter==="all"?C.acc:C.b1}`,
              background:filter==="all"?`${C.acc}15`:"none",
              color:filter==="all"?C.acc:C.mut2,
              fontSize:"0.59rem",cursor:"pointer"}}>
              Tout
            </button>
            {/* FIX: filtres dynamiques avec distinction PEE Natixis / PEE Amundi */}
            {filterOptions.map(opt=>{
              const col = C.cMap[opt.type]||C.acc
              const isActive = filter === opt.key
              return (
                <button key={opt.key} onClick={()=>setFilter(opt.key)} style={{...M,padding:"3px 8px",borderRadius:3,
                  border:`1px solid ${isActive?col:C.b1}`,
                  background:isActive?`${col}15`:"none",
                  color:isActive?col:C.mut2,
                  fontSize:"0.59rem",cursor:"pointer"}}>
                  {opt.label}
                </button>
              )
            })}
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
            {rows.map((h,idx)=>{
              const pnl=h.unrealizedPnL??h.fiscalPnL
              const pp=h.unrealizedPnLPercent
              return(
                <tr key={h.id||idx} style={{borderBottom:`1px solid ${C.b0}20`}}
                  onMouseEnter={e=>e.currentTarget.style.background=`${C.s2}80`}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{padding:"9px 10px"}}>
                    <div style={{fontSize:"0.78rem",color:C.tx,fontWeight:500}}>{h.name}</div>
                    <div style={{...M,fontSize:"0.58rem",color:C.mut2}}>{h.isin||h.ticker||""}</div>
                  </td>
                  <td style={{padding:"9px 10px"}}>
                    {/* FIX: afficher l'institution pour les PEE pour distinguer */}
                    <Tag c={C.cMap[h.accType]||C.mut2} sm>
                      {ACC_NAME[h.accType]||h.accType}
                      {h.accType==='PEE'&&h.instName?` ${h.instName.slice(0,3).toUpperCase()}`:''}
                    </Tag>
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
// GEO BAR
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
          ✓ Correction ETF appliquée — S&P 500 98% US · NASDAQ 98% US · MSCI World 65% US / 15% EU / 7% JP
        </p>
      </div>
    </Box>
  )
}

// ═══════════════════════════════════════════════════════════════════
// IMPORT PAGE
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
    const srcLabel={json:"JSON natif",boursobank:"BoursoBank",unknown:"format inconnu"}[result.source]||result.source
    setStatus({ok:true,msg:`✓ ${result.accounts.length} compte(s) · format ${srcLabel}`})
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
                  <div style={{...M,fontSize:"0.62rem",color:C.mut2}}>
                    {acc.holdings.length} position(s) : {acc.holdings.slice(0,3).map(h=>cleanHoldingName(h.name||h.isin||"?")).join(", ")}{acc.holdings.length>3?"…":""}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Box>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// STORAGE — localStorage (local) + Supabase (persistance distante)
// ═══════════════════════════════════════════════════════════════════
const SK = "pat_v5"
const load    = () => { try { const r=localStorage.getItem(SK); return r?JSON.parse(r):null } catch { return null } }
const persist = d  => { try { localStorage.setItem(SK,JSON.stringify(d)) } catch {} }

// ── Import dynamique de la couche Supabase ────────────────────────
// On importe via une promesse pour ne pas bloquer si le fichier
// n'existe pas encore (mode local-only).
// Import statique — plus fiable que l'import dynamique avec Next.js
// Si supabase.js n'est pas configuré, isConfigured() retourne false
// et toutes les fonctions retournent null silencieusement.
let sb = null
async function getSb() {
  if (sb) return sb
  try {
    const mod = await import("./lib/supabase.js")
    sb = mod.default ?? mod
    // Vérifier que le module est valide
    if (typeof sb?.isConfigured !== "function") {
      sb = null
      return null
    }
    return sb
  } catch {
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════
// INITIAL DATA — données complètes depuis portfolio.json
// ═══════════════════════════════════════════════════════════════════
const INIT = {
  profiles:[{
    id:"bastien", name:"Bastien", riskProfile:"dynamique", color:C.acc,
    snapshots:[{date:"2026-02-28", accounts:[
      {id:"boursobank-pea",name:"PEA LE GONIDEC",type:"PEA",institution:{name:"BoursoBank"},totalValue:6348.80,cashBalance:8.51,securitiesValue:6340.29,unrealizedPnL:-24.67,unrealizedPnLPercent:-0.39,totalContributed:6086.57,
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
      {id:"boursobank-cto",name:"CTO LE GONIDEC",type:"CTO",institution:{name:"BoursoBank"},totalValue:112.25,cashBalance:0,securitiesValue:112.25,unrealizedPnL:-104.33,unrealizedPnLPercent:-48.17,
       holdings:[
        {id:"c1",name:"IonQ",isin:"US46222L1089",ticker:"IONQ",assetClass:"EQUITIES",geography:["US"],quantity:3,currentValue:97.50,unrealizedPnL:-74.81,unrealizedPnLPercent:-43.42},
        {id:"c2",name:"Rigetti Computing",isin:"US76655K1034",ticker:"RGTI",assetClass:"EQUITIES",geography:["US"],quantity:1,currentValue:14.76,unrealizedPnL:-29.52,unrealizedPnLPercent:-66.67},
      ]},
      {id:"boursobank-livret-a",name:"Livret A BoursoBank",type:"LIVRET_A",institution:{name:"BoursoBank"},totalValue:707.00,cashBalance:707.00,securitiesValue:0,
       holdings:[{id:"la",name:"Livret A",assetClass:"CASH",geography:["FRANCE"],quantity:707,currentValue:707}]},
      {id:"lcl-av",name:"LCL Vie",type:"AV",institution:{name:"LCL"},totalValue:34218.64,cashBalance:0,securitiesValue:34218.64,unrealizedPnL:1775.86,unrealizedPnLPercent:5.48,
       holdings:[
        {id:"av1",name:"Support Euro LCL Vie",assetClass:"BONDS",geography:["UNKNOWN"],quantity:1,currentValue:23606.42,unrealizedPnL:936.86,unrealizedPnLPercent:4.13},
        {id:"av2",name:"LCL Équilibre ETF Select",isin:"FR0010833715",assetClass:"MIXED",geography:["US","EUROPE"],quantity:54.8,currentValue:10572.76,unrealizedPnL:839,unrealizedPnLPercent:8.62},
      ]},
      {id:"natixis-perco",name:"Plan Épargne Retraite Collectif",type:"PERCO",institution:{name:"Natixis"},totalValue:1335.48,cashBalance:0,securitiesValue:1335.48,unrealizedPnL:32.49,unrealizedPnLPercent:2.49,
       holdings:[
        {id:"pc1",name:"Expertise ESG Équilibre I",assetClass:"MIXED",geography:["EUROPE","GLOBAL"],quantity:3.74,currentValue:403.44,perf1y:3.21,riskLevel:3},
        {id:"pc2",name:"Avenir Actions Europe I",assetClass:"EQUITIES",geography:["EUROPE"],quantity:5.87,currentValue:276.65,perf1y:6.16,riskLevel:5},
        {id:"pc3",name:"DNCA Sérénité Plus I",assetClass:"MIXED",geography:["EUROPE"],quantity:51.08,currentValue:262.58,perf1y:0.76,riskLevel:3},
        {id:"pc4",name:"Mirova Actions Intl I",assetClass:"EQUITIES",geography:["GLOBAL"],quantity:6.99,currentValue:262.03,perf1y:0.55,riskLevel:5},
        {id:"pc5",name:"ISR Monétaire I",assetClass:"MONEY_MARKET",geography:["EUROPE"],quantity:6.74,currentValue:130.79,perf1y:0.38,riskLevel:1},
      ]},
      {id:"natixis-pee",name:"PEE Natixis",type:"PEE",institution:{name:"Natixis"},totalValue:3193.61,cashBalance:0,securitiesValue:3193.61,unrealizedPnL:102.08,unrealizedPnLPercent:3.30,
       holdings:[
        {id:"pn1",name:"Mirova Actions Intl I",assetClass:"EQUITIES",geography:["GLOBAL"],quantity:24.86,currentValue:931.78,perf1y:0.55,riskLevel:5},
        {id:"pn2",name:"Expertise ESG Équilibre I",assetClass:"MIXED",geography:["EUROPE","GLOBAL"],quantity:7.38,currentValue:795.77,perf1y:3.21,riskLevel:3},
        {id:"pn3",name:"Avenir Actions Europe I",assetClass:"EQUITIES",geography:["EUROPE"],quantity:13.78,currentValue:649.29,perf1y:6.16,riskLevel:5},
        {id:"pn4",name:"Expertise ESG Dynamique I",assetClass:"EQUITIES",geography:["EUROPE","GLOBAL"],quantity:2.54,currentValue:339.34,perf1y:10.30,riskLevel:4},
        {id:"pn5",name:"DNCA Sérénité Plus I",assetClass:"MIXED",geography:["EUROPE"],quantity:60.31,currentValue:310.00,perf1y:0.76,riskLevel:3},
        {id:"pn6",name:"ISR Monétaire I",assetClass:"MONEY_MARKET",geography:["EUROPE"],quantity:8.63,currentValue:167.44,perf1y:0.38,riskLevel:1},
      ]},
      {id:"binance-wallet",name:"Binance Wallet",type:"CRYPTO",institution:{name:"Binance"},totalValue:1280.43,cashBalance:84.54,securitiesValue:1195.89,
       holdings:[
        {id:"bt",name:"Bitcoin",ticker:"BTC",assetClass:"CRYPTO",geography:["CRYPTO_GLOBAL"],quantity:0.0121236,currentValue:659},
        {id:"et",name:"Ethereum",ticker:"ETH",assetClass:"CRYPTO",geography:["CRYPTO_GLOBAL"],quantity:0.27461,currentValue:436.27},
        {id:"uc",name:"USD Coin",ticker:"USDC",assetClass:"CASH",geography:["CRYPTO_GLOBAL"],quantity:5.28845,currentValue:84.49},
        {id:"sl",name:"Solana",ticker:"SOL",assetClass:"CRYPTO",geography:["CRYPTO_GLOBAL"],quantity:1.214184,currentValue:81.56},
        {id:"bn",name:"BNB",ticker:"BNB",assetClass:"CRYPTO",geography:["CRYPTO_GLOBAL"],quantity:0.037633,currentValue:19.06},
      ]},
      // FIX: PEE Amundi DS ajouté — était manquant dans INIT original
      {id:"amundi-pee-ds",name:"PEE Amundi — Dassault Systèmes",type:"PEE",institution:{name:"Amundi"},totalValue:8293.26,cashBalance:0,securitiesValue:8293.26,fiscalPnL:677.93,
       holdings:[
        {id:"pa1",name:"DS Actions Monde",assetClass:"EQUITIES",geography:["GLOBAL"],quantity:205.89,currentValue:3028.70,fiscalPnL:458.50,perf1y:10.77,riskLevel:4},
        {id:"pa2",name:"DS ISR Dynamique",assetClass:"MIXED",geography:["GLOBAL"],quantity:49.37,currentValue:1697.18,fiscalPnL:81.73,perf1y:0.76,riskLevel:3},
        {id:"pa3",name:"DS ISR Équilibre",assetClass:"MIXED",geography:["GLOBAL"],quantity:148.37,currentValue:1579.69,fiscalPnL:78.66,perf1y:1.49,riskLevel:3},
        {id:"pa4",name:"DS ISR Modéré",assetClass:"MIXED",geography:["GLOBAL"],quantity:99.24,currentValue:1000.65,fiscalPnL:53.25,perf1y:4.20,riskLevel:2},
        {id:"pa5",name:"Together Multiple 2025",assetClass:"MIXED",geography:["FRANCE"],quantity:26.08,currentValue:735.39,riskLevel:3},
        {id:"pa6",name:"Label Monétaire ESR",assetClass:"MONEY_MARKET",geography:["EUROPE"],quantity:0.19,currentValue:251.65,fiscalPnL:5.79,perf1y:2.03,riskLevel:1},
      ]},
      // FIX: PERCOL Amundi DS ajouté — était manquant dans INIT original
      {id:"amundi-percol-ds",name:"PER COL Amundi — Dassault Systèmes",type:"PERCOL",institution:{name:"Amundi"},totalValue:5041.13,cashBalance:0,securitiesValue:5041.13,fiscalPnL:472.93,
       holdings:[
        {id:"po1",name:"Amundi Convictions ESR",assetClass:"EQUITIES",geography:["GLOBAL"],quantity:23.39,currentValue:5041.13,fiscalPnL:472.93,perf1y:7.72,riskLevel:4}
      ]},
    ]}]
  }],
  lastUpdated:"2026-02-28"
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// MONTE CARLO ENGINE — par classe d'actif
// ═══════════════════════════════════════════════════════════════════

// Paramètres de rendement par classe — modifiables
const CLASS_PARAMS_DEFAULT = {
  "Actions":      { mu: 0.07, sigma: 0.15, label: "Actions Monde",   color: "#7dc830", note: "ETF World historique ~7% / 20 ans" },
  "Crypto-actifs":{ mu: 0.12, sigma: 0.60, label: "Crypto",          color: "#d4c820", note: "Espérance forte, dispersion extrême" },
  "Obligataire":  { mu: 0.03, sigma: 0.05, label: "Obligataire",     color: "#c88018", note: "Fonds obligataires, faible volatilité" },
  "Monétaire":    { mu: 0.025,sigma: 0.005,label: "Fonds Euro / Monétaire", color: "#1a9870", note: "Fonds €, quasi sans risque" },
  "Mixte":        { mu: 0.05, sigma: 0.10, label: "Mixte",           color: "#4a90e8", note: "Fonds équilibrés" },
}

// Enveloppe → classe dominante (pour suggestion automatique)
const ACC_CLASS = {
  PEA:     "Actions",
  CTO:     "Actions",
  CRYPTO:  "Crypto-actifs",
  AV:      "Obligataire",
  PEE:     "Mixte",
  PERCO:   "Actions",
  PERCOL:  "Actions",
  LIVRET_A:"Monétaire",
}

// ── Matrice de corrélation simplifiée (Cholesky 3×3) ──────────────
// Actifs : [Actions, Crypto, Obligataire/Monétaire]
// ρ(Actions,Crypto)=0.20  ρ(Actions,Oblig)=−0.15  ρ(Crypto,Oblig)=0.05
// L = décomposition de Cholesky de la matrice de corrélation
const CHOL = [
  [1,       0,       0      ],
  [0.20,    0.9798,  0      ],
  [-0.15,   0.0561,  0.9870 ],
]

function classToCorr(cls) {
  // Retourne l'index dans la matrice de corrélation
  if (cls === "Actions")       return 0
  if (cls === "Crypto-actifs") return 1
  return 2 // Obligataire, Monétaire, Mixte → corrélation neutre
}

function gaussianPair() {
  // Box-Muller
  const u1 = Math.random(), u2 = Math.random()
  const r = Math.sqrt(-2 * Math.log(u1 + 1e-12))
  return [r * Math.cos(2 * Math.PI * u2), r * Math.sin(2 * Math.PI * u2)]
}

// Monte Carlo multi-classe avec corrélations + apport croissant
// versements: [{cls, montant, mu, sigma}]
// croissance: {taux: 0.05, palierAns: 0, palierMontant: 0}  (invisible à l'UI sauf si activé)
function monteCarloMultiClass(tv, versements, horizon, inflation, N=2000, croissance={taux:0,palierAns:0,palierMontant:0}) {
  if (!versements.length) return []
  const totalMensuel = versements.reduce((s,v) => s+v.montant, 0)
  // Allocation initiale au pro-rata des versements
  const tvByClass = versements.map(v =>
    totalMensuel > 0 ? tv * (v.montant / totalMensuel) : tv / versements.length
  )

  const paths = []
  for (let i = 0; i < N; i++) {
    const vals = [...tvByClass]
    const path = [vals.reduce((s,v)=>s+v, 0)]

    for (let y = 1; y <= horizon; y++) {
      // 3 innovations corrélées via Cholesky
      const [z0a, z0b] = gaussianPair()
      const [z1a]      = gaussianPair()
      const w = [z0a, z0b * CHOL[1][1] + z0a * CHOL[1][0], z0a * CHOL[2][0] + z1a * CHOL[2][2]]

      // Apport mensuel de cette année (croissance + palier)
      const apportMult = (1 + croissance.taux) ** y
      const palierBonus = (croissance.palierAns > 0 && y >= croissance.palierAns)
        ? croissance.palierMontant : 0

      for (let j = 0; j < versements.length; j++) {
        const v = versements[j]
        const muR = v.mu - inflation
        const ci = classToCorr(v.cls)
        const z = w[ci]
        const apport = v.montant * apportMult * 12 + (j === 0 ? palierBonus * 12 : 0)
        vals[j] = vals[j] * Math.exp((muR - v.sigma*v.sigma/2) + v.sigma*z) + apport
      }
      path.push(vals.reduce((s,v)=>s+v, 0))
    }
    paths.push(path)
  }

  const data = []
  for (let y = 0; y <= horizon; y++) {
    const yearVals = paths.map(p => p[y]).sort((a,b) => a-b)
    const p = pct => yearVals[Math.min(Math.floor(pct * N / 100), N-1)]
    data.push({
      year: new Date().getFullYear() + y,
      p10: Math.round(p(10)), p25: Math.round(p(25)),
      p50: Math.round(p(50)), p75: Math.round(p(75)), p90: Math.round(p(90)),
    })
  }
  return data
}

function probSuccess(simData, objectif) {
  const last = simData[simData.length-1]
  if (!last) return 0
  // Interpolation linéaire entre percentiles connus
  if (objectif <= last.p10) return 93
  if (objectif <= last.p25) return Math.round(93 - 18 * (objectif - last.p10) / Math.max(last.p25 - last.p10, 1))
  if (objectif <= last.p50) return Math.round(75 - 25 * (objectif - last.p25) / Math.max(last.p50 - last.p25, 1))
  if (objectif <= last.p75) return Math.round(50 - 20 * (objectif - last.p50) / Math.max(last.p75 - last.p50, 1))
  if (objectif <= last.p90) return Math.round(30 - 18 * (objectif - last.p75) / Math.max(last.p90 - last.p75, 1))
  return Math.max(2, Math.round(12 - 10 * (objectif - last.p90) / Math.max(last.p90, 1)))
}

// Calcul mu/sigma consolidé d'un portefeuille multi-classe
function portfolioParams(versements) {
  const total = versements.reduce((s,v) => s+v.montant, 0)
  if (total === 0) return { mu: 0.05, sigma: 0.10 }
  let wMu = 0, wSig = 0
  for (const v of versements) {
    const w = v.montant / total
    wMu += w * v.mu
    wSig += w * v.sigma
  }
  return { mu: wMu, sigma: wSig }
}

// Diagnostique si le problème est le flux ou l'allocation
function diagnoseProblem(tv, versements, objectif, horizon, inflation) {
  const total = versements.reduce((s,v) => s+v.montant, 0)
  // Simulation "allocation parfaite" : 100% actions (μ=7%)
  const bestAlloc = [{ cls:"Actions", montant:total, mu:0.07, sigma:0.15 }]
  const simBest = monteCarloMultiClass(tv, bestAlloc, horizon, inflation, 800)
  const probBest = probSuccess(simBest, objectif)

  // Écart entre prob actuelle et prob optimale
  const simCurrent = monteCarloMultiClass(tv, versements, horizon, inflation, 800)
  const probCurrent = probSuccess(simCurrent, objectif)
  const allocGain = probBest - probCurrent // gain possible en réallouant

  // Combien faudrait-il épargner pour atteindre 50% de prob ?
  let montantNecessaire = total
  for (let m = total; m <= 5000; m += 50) {
    const sim = monteCarloMultiClass(tv, [{cls:"Actions",montant:m,mu:0.07,sigma:0.15}], horizon, inflation, 400)
    if (probSuccess(sim, objectif) >= 50) { montantNecessaire = m; break }
  }

  return { probBest, probCurrent, allocGain, montantNecessaire,
    isFluxProblem: probBest < 35, // même en optimisant, prob reste faible → c'est le flux
  }
}

// Recommandation par objectif d'optimisation
function computeRecommendation(versements, goal, objectif, horizon, tv, inflation) {
  const { mu, sigma } = portfolioParams(versements)
  const simData = monteCarloMultiClass(tv, versements, horizon, inflation, 600)
  const last = simData[simData.length-1]
  const prob = probSuccess(simData, objectif)
  const { isFluxProblem, probBest, montantNecessaire, allocGain } = diagnoseProblem(tv, versements, objectif, horizon, inflation)
  const total = versements.reduce((s,v) => s+v.montant, 0)

  // Message honnête selon la situation réelle
  let probText
  if (isFluxProblem) {
    probText = `Diagnostic : le levier n'est pas l'allocation. Même en passant 100% en Actions Monde, la probabilité plafonne à ${probBest}%. Le vrai levier est le flux d'épargne. Pour atteindre 50% de probabilité, il faudrait environ ${f$(montantNecessaire,true)}/mois (vs ${f$(total,true)} actuellement).`
  } else if (allocGain > 10) {
    probText = `Réallouer vers les Actions Monde pourrait augmenter la probabilité de +${allocGain} points. La variable d'ajustement reste l'allocation. ${mu < 0.06 ? "L'exposition actuelle aux classes défensives freine la trajectoire." : ""}`
  } else if (sigma > 0.25) {
    probText = `L'exposition Crypto crée une forte asymétrie : P90 élevé mais P10 bas. En termes de probabilité d'atteindre ${f$(objectif,true)}, les Actions Monde sont plus efficaces que la Crypto.`
  } else {
    probText = `Allocation optimisée pour maximiser la probabilité compte tenu des contraintes actuelles. L'objectif reste structurellement ambitieux vis-à-vis du flux d'épargne.`
  }

  const recByGoal = {
    probabilite: {
      label: "Maximiser probabilité d'atteinte",
      text: probText,
      icon: "◎", color: prob < 30 ? C.red : prob < 50 ? C.amb : C.acc,
    },
    mediane: {
      label: "Maximiser la médiane (P50)",
      text: `P50 à ${horizon} ans : ${f$(last?.p50,true)}${last?.p50 < objectif ? ` — ${f$(objectif-last?.p50,true)} en dessous de l'objectif` : " ✓"}. Actions Monde (μ=7%, σ=15%) maximise la médiane mieux que Crypto (μ=12% mais σ=60% dilue P50).`,
      icon: "◐", color: "#4a90e8",
    },
    upside: {
      label: "Maximiser le scénario optimiste (P90)",
      text: `P90 actuel : ${f$(last?.p90,true)}. La Crypto amplifie significativement le P90 (espérance +12%/an) mais dégrade le P10 (${f$(last?.p10,true)}). À utiliser avec modération : 5-10% des versements.`,
      icon: "↑", color: "#d4c820",
    },
    risque: {
      label: "Minimiser le drawdown (P10)",
      text: `Plancher P10 : ${f$(last?.p10,true)}. Chaque +10% d'allocation Obligataire/Fonds Euro réduit σ global de ~1.5pt au coût de ~0.4% de rendement espéré annuel. Cible : P10 > ${f$(tv,true)} (capital préservé en inflation réelle).`,
      icon: "◑", color: "#c88018",
    },
  }
  return { rec: recByGoal[goal] || recByGoal.probabilite, prob, simData, mu, sigma, isFluxProblem, montantNecessaire }
}

// ═══════════════════════════════════════════════════════════════════
// ONGLET 1 — TRAJECTOIRE : "Suis-je en bonne voie ?"
// ═══════════════════════════════════════════════════════════════════
function TabTrajectoire({profile, tv, snapshots, onGoToSimulation}) {
  const objectif  = profile.objectif      || 400000
  const horizon   = profile.horizonAns    || 15
  const apport    = profile.apportMensuel || 250
  const inflation = profile.inflation     || 0.02
  const txCroiss  = profile.apportCroissance || 0
  const palierAns = profile.palierAns     || 0
  const palierMt  = profile.palierMontant || 0

  const versBase = [{ cls:"Actions", montant:apport, mu:0.07, sigma:0.15 }]
  const croissance = { taux: txCroiss, palierAns, palierMontant: palierMt }

  const simData = useMemo(() =>
    monteCarloMultiClass(tv, versBase, horizon, inflation, 1200, croissance)
  , [tv, apport, horizon, inflation, txCroiss, palierAns, palierMt])

  const last      = simData[simData.length-1]
  const prob      = probSuccess(simData, objectif)
  const probColor = prob >= 65 ? C.acc : prob >= 40 ? C.amb : C.red
  const projGap   = (last?.p50||0) - objectif

  // Diagnostic honnête
  const simBestAlloc = useMemo(() =>
    monteCarloMultiClass(tv, [{cls:"Actions",montant:apport,mu:0.07,sigma:0.15}], horizon, inflation, 800)
  , [tv, apport, horizon, inflation])
  const probBest = probSuccess(simBestAlloc, objectif)
  const isFluxProblem = probBest < 35

  // Calcul apport nécessaire pour 50%
  const apportNecessaire = useMemo(() => {
    for (let m = apport; m <= 5000; m += 50) {
      const s = monteCarloMultiClass(tv, [{cls:"Actions",montant:m,mu:0.07,sigma:0.15}], horizon, inflation, 300)
      if (probSuccess(s, objectif) >= 50) return m
    }
    return null
  }, [tv, horizon, inflation, objectif, apport])

  // Apport effectif moyen sur la durée (avec croissance)
  const apportMoyen = txCroiss > 0
    ? Math.round(apport * ((1 + txCroiss) ** (horizon/2)))
    : apport

  return (
    <div style={{maxWidth:680, margin:"0 auto", padding:"32px 20px 48px", display:"flex", flexDirection:"column", gap:28}}>

      {/* ── Hero ── */}
      <div style={{textAlign:"center"}}>
        <div style={{...M, fontSize:"0.6rem", color:C.mut2, letterSpacing:"0.18em", textTransform:"uppercase", marginBottom:16}}>
          Trajectoire · {f$(objectif,true)} · {horizon} ans
        </div>
        <div style={{...S, fontSize:"5.5rem", color:probColor, lineHeight:0.9, letterSpacing:"-0.03em"}}>
          {prob}%
        </div>
        <div style={{...M, fontSize:"0.75rem", color:probColor, marginTop:12, letterSpacing:"0.06em"}}>
          {prob >= 65 ? "✓ Sur trajectoire" : prob >= 35 ? "⚡ En retard" : "✕ Désalignement flux / objectif"}
        </div>
        <div style={{...M, fontSize:"0.62rem", color:C.mut2, marginTop:6}}>
          probabilité d'atteindre {f$(objectif,true)} en {horizon} ans
        </div>
        <div style={{height:4, background:C.b1, borderRadius:2, overflow:"hidden", margin:"16px auto 0", maxWidth:320}}>
          <div style={{height:"100%", borderRadius:2, background:probColor, width:`${prob}%`, transition:"width 0.8s ease-out"}}/>
        </div>
      </div>

      {/* ── 3 métriques ── */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:1, background:C.b0, borderRadius:8, overflow:"hidden"}}>
        {[
          {l:"Patrimoine actuel", v:f$(tv), c:C.acc2},
          {l:`P50 dans ${horizon} ans`, v:f$(last?.p50,true), c:projGap>=0?C.acc2:C.amb2},
          {l:"Objectif", v:f$(objectif,true), c:C.mut2},
        ].map((k,i)=>(
          <div key={i} style={{background:C.s1, padding:"16px 14px", textAlign:"center"}}>
            <div style={{...M, fontSize:"0.53rem", color:C.mut3, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6}}>{k.l}</div>
            <div style={{...S, fontSize:"1.4rem", color:k.c, lineHeight:1}}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* ── Diagnostic honnête ── */}
      {isFluxProblem ? (
        <div style={{background:`${C.red}08`, border:`1px solid ${C.red}25`, borderRadius:8, padding:"16px 20px"}}>
          <div style={{...M, fontSize:"0.6rem", color:C.red2, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8}}>
            Diagnostic · problème de flux, pas d'allocation
          </div>
          <div style={{...M, fontSize:"0.66rem", color:C.tx2, lineHeight:1.9}}>
            Même en passant 100% en Actions Monde, la probabilité plafonne à <span style={{color:C.amb2}}>{probBest}%</span>.<br/>
            Le levier n'est pas l'allocation — c'est le niveau d'épargne mensuel.<br/>
            {apportNecessaire && (
              <span>Pour atteindre 50% de probabilité : <span style={{color:C.acc2}}>{f$(apportNecessaire,true)}/mois</span> sont nécessaires{" "}
              <span style={{color:C.mut3}}>(vs {f$(apport,true)} actuellement — écart {f$(apportNecessaire-apport,true)}/mois)</span>.</span>
            )}
          </div>
        </div>
      ) : (
        <div style={{background:prob>=50?`${C.acc}08`:`${C.amb}08`, border:`1px solid ${prob>=50?C.acc:C.amb}20`, borderRadius:8, padding:"16px 20px"}}>
          {prob >= 50 ? (
            <div style={{...M, fontSize:"0.65rem", color:C.acc2, lineHeight:1.9}}>
              ✓ L'apport de {f$(apport,true)}/mois place la médiane à {f$(last?.p50,true)} — au-dessus de l'objectif.<br/>
              <span style={{color:C.mut2}}>P10 : {f$(last?.p10,true)} · P90 : {f$(last?.p90,true)} · Intervalle 50% : {f$(last?.p25,true)}–{f$(last?.p75,true)}</span>
            </div>
          ) : (
            <div style={{...M, fontSize:"0.65rem", color:C.amb2, lineHeight:1.9}}>
              ⚡ P50 à {f$(last?.p50,true)} — {f$(Math.abs(projGap),true)} sous l'objectif.<br/>
              L'allocation peut être optimisée (+{probBest-prob} pts en passant 100% actions).<br/>
              {apportNecessaire && <span style={{color:C.mut2}}>Apport nécessaire pour 50% : {f$(apportNecessaire,true)}/mois.</span>}
            </div>
          )}
        </div>
      )}

      {/* ── Graphique ── */}
      <div>
        <div style={{...M, fontSize:"0.53rem", color:C.mut3, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:10}}>
          Projection 1 200 simulations · rendements réels · corrélations actifs
        </div>
        <div style={{height:200}}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={simData} margin={{top:4,right:8,bottom:0,left:0}}>
              <defs>
                <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.acc} stopOpacity={0.10}/>
                  <stop offset="95%" stopColor={C.acc} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 6" stroke={C.b0} vertical={false}/>
              <XAxis dataKey="year" tick={{...M,fontSize:"0.5rem",fill:C.mut3}} tickLine={false} interval={Math.floor(horizon/5)}/>
              <YAxis tickFormatter={v=>f$(v,true)} tick={{...M,fontSize:"0.5rem",fill:C.mut3}} tickLine={false} axisLine={false}/>
              <Area type="monotone" dataKey="p90" stroke="none" fill="url(#tg)" dot={false}/>
              <Area type="monotone" dataKey="p10" stroke="none" fill={C.bg} dot={false}/>
              <Area type="monotone" dataKey="p50" stroke={C.amb} strokeWidth={2} fill="none" dot={false}/>
              <Area type="monotone" dataKey="p90" stroke={`${C.acc}50`} strokeWidth={1} fill="none" strokeDasharray="3 3" dot={false}/>
              <Area type="monotone" dataKey="p10" stroke={`${C.red}50`} strokeWidth={1} fill="none" strokeDasharray="3 3" dot={false}/>
              <Area type="monotone" dataKey={() => objectif} stroke={`${probColor}60`} strokeWidth={1.5} fill="none" strokeDasharray="6 4" dot={false}/>
              <Tooltip content={({active,payload,label})=>{
                if(!active||!payload?.length) return null
                return(
                  <div style={{background:C.s2,border:`1px solid ${C.b1}`,borderRadius:6,padding:"8px 12px"}}>
                    <div style={{...M,fontSize:"0.58rem",color:C.mut3,marginBottom:4}}>{label}</div>
                    {[{k:"p90",l:"P90",c:C.acc2},{k:"p50",l:"P50 (médiane)",c:C.amb2},{k:"p10",l:"P10",c:C.red2}].map(({k,l,c})=>{
                      const p=payload.find(x=>x.dataKey===k); if(!p) return null
                      return <div key={k} style={{...M,fontSize:"0.62rem",color:c}}>{l} : {f$(p.value,true)}</div>
                    })}
                  </div>
                )
              }}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{textAlign:"center"}}>
        <button onClick={onGoToSimulation} style={{
          ...M, padding:"10px 24px", borderRadius:6,
          border:`1px solid ${C.acc}`, background:`${C.acc}10`,
          color:C.acc, fontSize:"0.68rem", cursor:"pointer", letterSpacing:"0.06em",
        }}>
          → Simuler des ajustements
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// ONGLET 2 — DIAGNOSTIC : "Pourquoi ?"
// ═══════════════════════════════════════════════════════════════════
function TabDiagnostic({profile, accounts, assets, alerts, tv, onGoToSimulation}) {
  const tgt = TARGETS[profile.riskProfile] || TARGETS.dynamique
  const topAlerts = alerts.slice(0, 3)

  // Écart allocation actuelle vs cible
  const allocRows = Object.entries(tgt).map(([cls, t]) => {
    const c = assets.find(a => a.label === cls)?.percent || 0
    const gap = c - t
    return { cls, current: c, target: t, gap,
      color: C.aMap[Object.keys(ASSET_NAME).find(k=>ASSET_NAME[k]===cls)||"UNKNOWN"]||C.mut3 }
  }).sort((a,b) => Math.abs(b.gap)-Math.abs(a.gap))

  const mainTension = allocRows[0]
  const hasTension  = Math.abs(mainTension?.gap||0) > 12

  return (
    <div style={{maxWidth:900, margin:"0 auto", padding:"28px 20px 48px", display:"flex", flexDirection:"column", gap:20}}>

      {/* ── Allocation : le diagnostic visuel ── */}
      <Box>
        <BoxHead title="Allocation actuelle vs cible" badge={`profil ${profile.riskProfile}`} hl={hasTension?C.amb:C.acc}/>
        <div style={{padding:"16px 20px"}}>
          {hasTension && (
            <div style={{background:`${C.amb}10`, border:`1px solid ${C.amb}25`, borderRadius:6, padding:"10px 14px", marginBottom:16}}>
              <span style={{...M, fontSize:"0.65rem", color:C.amb2}}>
                ⚡ {mainTension.cls} : {mainTension.current.toFixed(0)}% actuel vs {mainTension.target}% cible
                {mainTension.gap > 0 ? " — surexposé" : " — sous-exposé"}
                {" "}· impact estimé sur rendement espéré : {mainTension.gap > 0 && mainTension.cls !== "Actions" ? "−" : "+"}{Math.abs(mainTension.gap * 0.02).toFixed(2)}% / an
              </span>
            </div>
          )}
          <div style={{display:"flex", flexDirection:"column", gap:8}}>
            {allocRows.filter(r => r.target > 0 || r.current > 0).map((r,i) => (
              <div key={i} style={{display:"grid", gridTemplateColumns:"120px 1fr 1fr 60px", gap:10, alignItems:"center"}}>
                <span style={{...M, fontSize:"0.66rem", color:C.tx2}}>{r.cls}</span>
                <div style={{position:"relative", height:6, background:C.b1, borderRadius:3, overflow:"visible"}}>
                  <div style={{position:"absolute", height:"100%", borderRadius:3, background:r.color, width:`${Math.min(r.current,100)}%`, opacity:0.7}}/>
                  {/* Marker cible */}
                  <div style={{position:"absolute", top:-3, width:2, height:12, background:C.mut2, borderRadius:1, left:`${Math.min(r.target,100)}%`}}/>
                </div>
                <div style={{display:"flex", gap:6, alignItems:"center"}}>
                  <span style={{...M, fontSize:"0.62rem", color:r.color}}>{r.current.toFixed(1)}%</span>
                  <span style={{...M, fontSize:"0.56rem", color:C.mut3}}>vs {r.target}%</span>
                </div>
                <span style={{...M, fontSize:"0.62rem", color:Math.abs(r.gap)<5?C.mut3:r.gap>0?C.amb2:C.blu2, textAlign:"right"}}>
                  {r.gap>0?"+":""}{r.gap.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
          <div style={{...M, fontSize:"0.54rem", color:C.mut3, marginTop:10}}>
            — barre cible · barre colorée = actuel
          </div>
        </div>
      </Box>

      {/* ── Top 3 alertes ── */}
      {topAlerts.length > 0 && (
        <Box>
          <BoxHead title="Signaux prioritaires" badge={`${alerts.length} au total`} hl={alerts[0]?.lvl==="danger"?C.red:C.amb}/>
          <div style={{padding:"12px 16px", display:"flex", flexDirection:"column", gap:8}}>
            {topAlerts.map((a,i) => {
              const lev = {danger:C.red2, warning:C.amb2, info:C.blu2}[a.lvl]||C.blu2
              return (
                <div key={i} style={{display:"flex", gap:12, padding:"10px 14px", background:C.s2, borderRadius:6, borderLeft:`3px solid ${lev}`}}>
                  <span style={{fontSize:"1rem", lineHeight:1.2, minWidth:20}}>{a.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:"0.77rem", color:C.tx, marginBottom:3}}>{a.title}</div>
                    <div style={{...M, fontSize:"0.61rem", color:C.mut2, lineHeight:1.6}}>{a.action}</div>
                  </div>
                  <span style={{...M, fontSize:"0.68rem", color:lev, whiteSpace:"nowrap"}}>{a.metric}</span>
                </div>
              )
            })}
            {alerts.length > 3 && (
              <div style={{...M, fontSize:"0.57rem", color:C.mut3, textAlign:"center", paddingTop:2}}>
                +{alerts.length-3} signaux supplémentaires dans Détail
              </div>
            )}
          </div>
        </Box>
      )}

      {/* ── CTA ── */}
      <div style={{display:"flex", gap:10, justifyContent:"center"}}>
        <button onClick={onGoToSimulation} style={{
          ...M, padding:"10px 24px", borderRadius:6,
          border:`1px solid ${C.acc}`, background:`${C.acc}10`,
          color:C.acc, fontSize:"0.68rem", cursor:"pointer", letterSpacing:"0.06em",
        }}>
          → Simuler des ajustements
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// ONGLET 3 — SIMULATION : moteur décisionnel
// ═══════════════════════════════════════════════════════════════════
function TabSimulation({profile, tv, assets, accounts, onUpdateProfile}) {
  const [objectif,  setObjectifRaw]  = useState(profile.objectif     || 400000)
  const [horizon,   setHorizonRaw]   = useState(profile.horizonAns   || 15)
  const [inflation, setInflation]    = useState(profile.inflation     || 0.02)
  const [goalType,  setGoalType]     = useState("probabilite")
  const [txCroiss,  setTxCroiss]     = useState(profile.apportCroissance || 0)
  const [palierAns, setPalierAns]    = useState(profile.palierAns    || 0)
  const [palierMt,  setPalierMt]     = useState(profile.palierMontant|| 0)
  const [showCroiss,setShowCroiss]   = useState(false)

  const setObjectif = v => { setObjectifRaw(v);  onUpdateProfile({objectif:v}) }
  const setHorizon  = v => { setHorizonRaw(v);   onUpdateProfile({horizonAns:v}) }

  // Sliders par CLASSE D'ACTIF (pas par compte)
  const [classVers, setClassVers] = useState(() => ({
    "Actions":       profile.apportMensuel || 250,
    "Crypto-actifs": 0,
    "Obligataire":   0,
    "Monétaire":     0,
  }))

  const totalVersement = Object.values(classVers).reduce((s,v)=>s+v, 0)
  const croissance = { taux: txCroiss, palierAns, palierMontant: palierMt }

  // Versements consolidés pour MC
  const versements = useMemo(() =>
    Object.entries(classVers)
      .filter(([,m]) => m > 0)
      .map(([cls, montant]) => ({
        cls, montant,
        mu:    CLASS_PARAMS_DEFAULT[cls]?.mu    || 0.05,
        sigma: CLASS_PARAMS_DEFAULT[cls]?.sigma || 0.10,
      }))
  , [classVers])

  const versToSim = versements.length > 0 ? versements : [{cls:"Actions", montant:250, mu:0.07, sigma:0.15}]

  const simData = useMemo(() =>
    monteCarloMultiClass(tv, versToSim, horizon, inflation, 1200, croissance)
  , [tv, JSON.stringify(versToSim), horizon, inflation, txCroiss, palierAns, palierMt])

  const { rec, prob, mu, sigma, isFluxProblem, montantNecessaire } = useMemo(() =>
    computeRecommendation(versToSim, goalType, objectif, horizon, tv, inflation)
  , [JSON.stringify(versToSim), goalType, objectif, horizon, tv, inflation])

  const last = simData[simData.length-1]
  const probColor = prob >= 65 ? C.acc : prob >= 40 ? C.amb : C.red

  // Affectation automatique des enveloppes
  const enveloppeRecommandee = (cls) => {
    if (cls === "Actions")       return "PEA prioritaire → MSCI World"
    if (cls === "Crypto-actifs") return "Binance · DCA mensuel"
    if (cls === "Obligataire")   return "AV fonds euro · Livret A"
    if (cls === "Monétaire")     return "Livret A · fonds monétaires"
    return ""
  }

  const Slider = ({label, val, set, min, max, step, unit="", col=C.acc, fmt}) => (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex", justifyContent:"space-between", marginBottom:3}}>
        <span style={{...M, fontSize:"0.61rem", color:C.mut2}}>{label}</span>
        <span style={{...M, fontSize:"0.67rem", color:col}}>{fmt ? fmt(val) : val}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val}
        onChange={e=>set(Number(e.target.value))}
        style={{width:"100%", accentColor:col, cursor:"pointer", height:4}}/>
    </div>
  )

  const GOALS = [
    {k:"probabilite", icon:"◎", l:"Prob. d'atteinte"},
    {k:"mediane",     icon:"◐", l:"Médiane P50"},
    {k:"upside",      icon:"↑", l:"Upside P90"},
    {k:"risque",      icon:"◑", l:"Sécuriser P10"},
  ]

  return (
    <div style={{maxWidth:1200, margin:"0 auto", padding:"24px 20px 48px", display:"flex", flexDirection:"column", gap:20}}>

      {/* ── BLOC 1 : Objectif d'optimisation ── */}
      <Box>
        <BoxHead title="Objectif d'optimisation" badge="Quel résultat maximiser ?" hl={rec.color}/>
        <div style={{padding:"14px 20px"}}>
          <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:16}}>
            {GOALS.map(g => (
              <button key={g.k} onClick={()=>setGoalType(g.k)} style={{
                padding:"12px 14px", border:`1px solid ${goalType===g.k?rec.color:C.b1}`,
                borderRadius:7, cursor:"pointer", textAlign:"left",
                background: goalType===g.k ? `${rec.color}12` : C.s2, transition:"all 0.15s",
              }}>
                <div style={{...M, fontSize:"1rem", color:goalType===g.k?rec.color:C.mut3, marginBottom:4}}>{g.icon}</div>
                <div style={{...M, fontSize:"0.62rem", color:goalType===g.k?rec.color:C.tx2}}>{g.l}</div>
              </button>
            ))}
          </div>

          {/* Recommandation contextuelle */}
          <div style={{background:`${rec.color}08`, border:`1px solid ${rec.color}20`, borderRadius:6, padding:"12px 16px", display:"flex", gap:12, alignItems:"flex-start"}}>
            <span style={{fontSize:"1.2rem", lineHeight:1}}>{rec.icon}</span>
            <div>
              <div style={{...M, fontSize:"0.6rem", color:rec.color, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4}}>{rec.label}</div>
              <div style={{...M, fontSize:"0.65rem", color:C.tx2, lineHeight:1.8}}>{rec.text}</div>
            </div>
          </div>

          {/* Diagnostic flux si prob < 35% */}
          {isFluxProblem && (
            <div style={{background:`${C.red}06`, border:`1px solid ${C.red}20`, borderRadius:6, padding:"10px 14px", marginTop:8, display:"flex", gap:10, alignItems:"center"}}>
              <span style={{fontSize:"0.9rem"}}>⚡</span>
              <div style={{...M, fontSize:"0.62rem", color:C.mut2, lineHeight:1.7}}>
                <span style={{color:C.red2}}>Contrainte de flux :</span> quel que soit le portefeuille, la probabilité est structurellement limitée par le montant épargné.{" "}
                {montantNecessaire && <span>Seuil pour 50% : <span style={{color:C.acc2}}>{f$(montantNecessaire,true)}/mois</span>.</span>}
              </div>
            </div>
          )}
        </div>
      </Box>

      <div style={{display:"grid", gridTemplateColumns:"380px 1fr", gap:20}}>

        {/* ── BLOC 2 : Sliders par classe ── */}
        <div style={{display:"flex", flexDirection:"column", gap:16}}>
          <Box>
            <BoxHead title="Versements mensuels par classe" badge={`Total : ${f$(totalVersement,true)}/mois`} hl={C.acc}/>
            <div style={{padding:"16px 20px"}}>
              <div style={{...M, fontSize:"0.56rem", color:C.mut3, marginBottom:14, lineHeight:1.8}}>
                Sliders par classe d'actif — l'outil affecte automatiquement vers les enveloppes optimales.
              </div>
              {Object.entries(CLASS_PARAMS_DEFAULT).slice(0,4).map(([cls, p]) => (
                <div key={cls} style={{marginBottom:18}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6}}>
                    <div>
                      <span style={{...M, fontSize:"0.66rem", color:p.color}}>{p.label}</span>
                      <span style={{...M, fontSize:"0.56rem", color:C.mut3, marginLeft:8}}>μ={( p.mu*100).toFixed(0)}% σ={(p.sigma*100).toFixed(0)}%</span>
                    </div>
                    <span style={{...M, fontSize:"0.68rem", color:p.color}}>{f$(classVers[cls]||0,true)}/mois</span>
                  </div>
                  <input type="range" min={0} max={1500} step={50}
                    value={classVers[cls]||0}
                    onChange={e=>setClassVers(prev=>({...prev,[cls]:Number(e.target.value)}))}
                    style={{width:"100%", accentColor:p.color, cursor:"pointer", height:4}}/>
                  <div style={{...M, fontSize:"0.55rem", color:C.mut3, marginTop:3}}>
                    ↳ {enveloppeRecommandee(cls)}
                  </div>
                </div>
              ))}

              {/* Paramètres secondaires */}
              <div style={{borderTop:`1px solid ${C.b0}`, paddingTop:14, marginTop:6}}>
                <Slider label="🎯 Objectif" val={objectif} set={setObjectif} min={50000} max={2000000} step={10000} col={probColor}
                  fmt={v=>f$(v,true)}/>
                <Slider label="⏳ Horizon" val={horizon} set={setHorizon} min={5} max={35} step={1} unit=" ans" col={C.blu2}/>
                <Slider label="📈 Inflation" val={inflation} set={setInflation} min={0} max={0.06} step={0.005} col={C.amb2}
                  fmt={v=>`${(v*100).toFixed(1)}%/an`}/>

                {/* Apport croissant */}
                <div style={{borderTop:`1px solid ${C.b0}`, paddingTop:12, marginTop:6}}>
                  <button onClick={()=>setShowCroiss(s=>!s)} style={{...M, background:"none", border:"none", color:txCroiss>0||palierMt>0?C.acc:C.mut3, fontSize:"0.6rem", cursor:"pointer", padding:0, letterSpacing:"0.04em"}}>
                    {showCroiss?"▾":"▸"} Apport croissant {txCroiss>0?`· +${(txCroiss*100).toFixed(0)}%/an`:""}{palierMt>0?` · +${f$(palierMt,true)} dans ${palierAns}a`:""}
                  </button>
                  {showCroiss && (
                    <div style={{marginTop:10}}>
                      <Slider label="Croissance annuelle de l'apport" val={txCroiss} set={v=>{setTxCroiss(v);onUpdateProfile({apportCroissance:v})}} min={0} max={0.15} step={0.01} col={C.acc}
                        fmt={v=>v===0?"—":`+${(v*100).toFixed(0)}%/an`}/>
                      <div style={{...M, fontSize:"0.55rem", color:C.mut3, marginBottom:8}}>
                        Ex. +5%/an → {f$(Math.round(totalVersement*(1.05**5)),true)}/mois dans 5 ans
                      </div>
                      <Slider label="Palier futur (bonus ponctuel)" val={palierMt} set={v=>{setPalierMt(v);onUpdateProfile({palierMontant:v})}} min={0} max={2000} step={50} col={C.blu2}
                        fmt={v=>v===0?"—":`+${f$(v,true)}/mois`}/>
                      {palierMt > 0 && (
                        <Slider label="  └ à partir de l'année" val={palierAns} set={v=>{setPalierAns(v);onUpdateProfile({palierAns:v})}} min={1} max={horizon} step={1} unit=" ans" col={C.blu2}/>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Box>

          {/* μ/σ résultants */}
          <div style={{background:C.s2, border:`1px solid ${C.b1}`, borderRadius:8, padding:"14px 16px"}}>
            <div style={{...M, fontSize:"0.54rem", color:C.mut3, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10}}>Portefeuille résultant</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8}}>
              {[
                {l:"μ portefeuille", v:`${(mu*100).toFixed(1)}%/an`, c:C.acc2},
                {l:"σ volatilité",   v:`${(sigma*100).toFixed(1)}%`,  c:C.amb2},
                {l:"μ réel (−infl)", v:`${((mu-inflation)*100).toFixed(1)}%`, c:C.tel},
              ].map((k,i)=>(
                <div key={i} style={{textAlign:"center"}}>
                  <div style={{...M, fontSize:"0.52rem", color:C.mut3, marginBottom:3}}>{k.l}</div>
                  <div style={{...M, fontSize:"0.78rem", color:k.c}}>{k.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── BLOC 3 : Résultats ── */}
        <Box>
          <BoxHead title="Projection Monte Carlo" badge="500 simulations · rendements réels" hl={probColor}/>
          <div style={{padding:"16px 20px"}}>

            {/* Probabilité + P-values */}
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginBottom:20}}>
              {[
                {l:`Prob. ${f$(objectif,true)}`, v:`${prob}%`, c:probColor, big:true},
                {l:"P10 (pessimiste)",  v:f$(last?.p10,true), c:C.red2},
                {l:"P50 (médiane)",     v:f$(last?.p50,true), c:C.amb2},
                {l:"P90 (optimiste)",   v:f$(last?.p90,true), c:C.acc2},
              ].map((k,i)=>(
                <div key={i} style={{background:C.s2, borderRadius:6, padding:"10px 12px", textAlign:"center", border:k.big?`1px solid ${probColor}30`:"none"}}>
                  <div style={{...M, fontSize:"0.53rem", color:C.mut3, marginBottom:4}}>{k.l}</div>
                  <div style={{...S, fontSize:k.big?"1.8rem":"1.1rem", color:k.c, lineHeight:1}}>{k.v}</div>
                </div>
              ))}
            </div>

            {/* Graphique */}
            <div style={{height:260}}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={simData} margin={{top:4,right:8,bottom:0,left:0}}>
                  <defs>
                    <linearGradient id="sg3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.acc} stopOpacity={0.1}/>
                      <stop offset="95%" stopColor={C.acc} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 6" stroke={C.b0} vertical={false}/>
                  <XAxis dataKey="year" tick={{...M,fontSize:"0.5rem",fill:C.mut3}} tickLine={false} interval={Math.floor(horizon/5)}/>
                  <YAxis tickFormatter={v=>f$(v,true)} tick={{...M,fontSize:"0.5rem",fill:C.mut3}} tickLine={false} axisLine={false}/>
                  <Area type="monotone" dataKey="p90" stroke="none" fill="url(#sg3)" dot={false}/>
                  <Area type="monotone" dataKey="p10" stroke="none" fill={C.bg} dot={false}/>
                  <Area type="monotone" dataKey="p50" stroke={C.amb} strokeWidth={2} fill="none" dot={false}/>
                  <Area type="monotone" dataKey="p90" stroke={`${C.acc}60`} strokeWidth={1} fill="none" strokeDasharray="3 3" dot={false}/>
                  <Area type="monotone" dataKey="p10" stroke={`${C.red}60`} strokeWidth={1} fill="none" strokeDasharray="3 3" dot={false}/>
                  <Area type="monotone" dataKey={() => objectif} stroke={`${probColor}60`} strokeWidth={1.5} fill="none" strokeDasharray="6 4" dot={false}/>
                  <Tooltip content={({active,payload,label})=>{
                    if(!active||!payload?.length) return null
                    return(
                      <div style={{background:C.s2,border:`1px solid ${C.b1}`,borderRadius:6,padding:"8px 12px"}}>
                        <div style={{...M,fontSize:"0.58rem",color:C.mut3,marginBottom:4}}>{label}</div>
                        {[{k:"p90",l:"P90",c:C.acc2},{k:"p50",l:"P50",c:C.amb2},{k:"p10",l:"P10",c:C.red2}].map(({k,l,c})=>{
                          const p=payload.find(x=>x.dataKey===k); if(!p) return null
                          return <div key={k} style={{...M,fontSize:"0.62rem",color:c}}>{l} : {f$(p.value,true)}</div>
                        })}
                      </div>
                    )
                  }}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Décomposition par classe */}
            {versements.length > 1 && (
              <div style={{borderTop:`1px solid ${C.b0}`, marginTop:16, paddingTop:14}}>
                <div style={{...M, fontSize:"0.54rem", color:C.mut3, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8}}>Impact par classe sur P50</div>
                <div style={{display:"flex", flexDirection:"column", gap:5}}>
                  {versements.map((v,i) => {
                    const p = CLASS_PARAMS_DEFAULT[v.cls]
                    const contribution = v.montant * 12 * horizon * (1 + v.mu) // approximatif
                    return (
                      <div key={i} style={{display:"flex", alignItems:"center", gap:10}}>
                        <div style={{width:8,height:8,borderRadius:2,background:p?.color||C.mut3,flexShrink:0}}/>
                        <span style={{...M,fontSize:"0.62rem",color:C.tx2,flex:1}}>{p?.label||v.cls}</span>
                        <span style={{...M,fontSize:"0.6rem",color:C.mut2}}>{f$(v.montant,true)}/mois</span>
                        <span style={{...M,fontSize:"0.6rem",color:p?.color||C.mut3,minWidth:60,textAlign:"right"}}>μ={(v.mu*100).toFixed(0)}% σ={(v.sigma*100).toFixed(0)}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{...M, fontSize:"0.54rem", color:C.mut3, marginTop:14, lineHeight:1.8, borderTop:`1px solid ${C.b0}`, paddingTop:10}}>
              ⚠ Simulations indépendantes par classe · corrélations non modélisées<br/>
              Rendements en € {new Date().getFullYear()} après inflation {(inflation*100).toFixed(1)}% · PEA exonéré IR après 5 ans
            </div>
          </div>
        </Box>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// ONGLET 4 — DÉTAIL
// ═══════════════════════════════════════════════════════════════════
function TabDetail({accounts, geo, assets, tv, metrics, snapshots, profile, alerts}) {
  return (
    <div style={{maxWidth:1200, margin:"0 auto", padding:"20px 20px 48px", display:"flex", flexDirection:"column", gap:16}}>
      <PerfModule metrics={metrics} snapshots={snapshots}/>
      <ChartsRow accounts={accounts} tv={tv} assets={assets} geo={geo}/>
      <GeoBar geo={geo}/>
      {alerts.length > 0 && <AlertsPanel alerts={alerts}/>}
      <RebalancingPanel profile={profile} accounts={accounts} assets={assets} tv={tv}/>
      <AllocTable profile={profile} assets={assets} tv={tv}/>
      <HoldingsTable accounts={accounts}/>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD — navigation 4 onglets
// ═══════════════════════════════════════════════════════════════════
function Dashboard({profile, snapshots, onUpdateProfile}) {
  const [tab, setTab] = useState('trajectoire')
  const last = snapshots[snapshots.length-1]
  const accounts = last?.accounts||[]
  const tv = accounts.reduce((s,a)=>s+(a.totalValue||0),0)
  const pnl = accounts.reduce((s,a)=>s+(a.unrealizedPnL||a.fiscalPnL||0),0)
  const assets = useMemo(()=>assetBreakdown(accounts),[accounts])
  const geo = useMemo(()=>geoExposure(accounts),[accounts])
  const metrics = useMemo(()=>perfMetrics(snapshots)||{tv,pnl,pnlPct:null,ytd:null,cagr:null,xirr:null},[snapshots,tv,pnl])
  const alerts = useMemo(()=>computeAlerts(profile,accounts,geo,assets,tv),[profile,accounts,geo,assets,tv])

  const TABS = [
    {k:'trajectoire', l:'Trajectoire', desc:'Suis-je en bonne voie ?'},
    {k:'diagnostic',  l:'Diagnostic',  desc:'Pourquoi ?'},
    {k:'simulation',  l:'Simulation',  desc:'Et si ?'},
    {k:'detail',      l:'Détail',      desc:'Tout voir'},
  ]

  const dangerCount = alerts.filter(a=>a.lvl==="danger").length

  return (
    <div style={{background:C.bg, minHeight:"calc(100vh - 46px)"}}>
      {/* Header compact */}
      <div style={{maxWidth:1440, margin:"0 auto", padding:"14px 20px 0", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div style={{display:"flex", alignItems:"baseline", gap:14}}>
          <div style={{...S, fontSize:"1.5rem", color:C.tx, letterSpacing:"-0.02em"}}>
            {profile.name}
          </div>
          <div style={{...S, fontSize:"1.9rem", color:C.acc2, letterSpacing:"-0.02em", lineHeight:1}}>{f$(tv)}</div>
          <div style={{...M, fontSize:"0.66rem", color:pnl?pc(pnl):C.mut2}}>
            {pnl?`${pnl>=0?"+":""}${f$(pnl,true)}`:"—"}
          </div>
        </div>
        <div style={{display:"flex", gap:6, alignItems:"center"}}>
          <Tag c={profile.color}>profil {profile.riskProfile}</Tag>
          <Tag c={C.mut3}>{last?.date||"—"}</Tag>
          {dangerCount>0 && <Tag c={C.red}>{dangerCount} alerte{dangerCount>1?"s":""}</Tag>}
        </div>
      </div>

      {/* Tab nav */}
      <div style={{maxWidth:1440, margin:"0 auto", padding:"0 20px"}}>
        <div style={{display:"flex", gap:0, borderBottom:`1px solid ${C.b0}`, marginTop:14}}>
          {TABS.map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} style={{
              ...M, padding:"10px 20px", border:"none", borderBottom:`2px solid ${tab===t.k?C.acc:"transparent"}`,
              background:"none", color:tab===t.k?C.acc:C.mut2, fontSize:"0.66rem", cursor:"pointer",
              letterSpacing:"0.06em", transition:"color 0.15s", lineHeight:1,
            }}>
              {t.l}
              <div style={{fontSize:"0.5rem", color:tab===t.k?C.acc2:C.mut3, marginTop:2, letterSpacing:"0.04em"}}>{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {tab==='trajectoire' && <TabTrajectoire profile={profile} tv={tv} snapshots={snapshots} onGoToSimulation={()=>setTab('simulation')}/>}
      {tab==='diagnostic'  && <TabDiagnostic  profile={profile} accounts={accounts} assets={assets} alerts={alerts} tv={tv} onGoToSimulation={()=>setTab('simulation')}/>}
      {tab==='simulation'  && <TabSimulation  profile={profile} tv={tv} assets={assets} accounts={accounts} onUpdateProfile={onUpdateProfile}/>}
      {tab==='detail'      && <TabDetail      accounts={accounts} geo={geo} assets={assets} tv={tv} metrics={metrics} snapshots={snapshots} profile={profile} alerts={alerts}/>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════════════
export default function App() {
  const [data,   setData]   = useState(null)
  const [pid,    setPid]    = useState(null)
  const [page,   setPage]   = useState("dashboard")
  const [dbStatus, setDbStatus] = useState("idle") // "idle"|"syncing"|"ok"|"error"

  // ── Chargement initial ──────────────────────────────────────────
  useEffect(() => {
    async function init() {
      // 1. Charger depuis localStorage immédiatement (affichage instantané)
      const local = load() || INIT
      setData(local)
      setPid(local.profiles[0]?.id)

      // 2. Tenter de synchroniser depuis Supabase en arrière-plan
      const db = await getSb()
      if (!db?.isConfigured()) return // mode local-only, pas de Supabase configuré

      setDbStatus("syncing")
      try {
        const profileId = local.profiles[0]?.id || "bastien"

        // Charger le profil distant (préférences)
        const dbProfile = await db.fetchProfile(profileId)

        // Charger les snapshots distants
        const dbSnaps = await db.fetchSnapshots(profileId)

        if (dbSnaps && dbSnaps.length > 0) {
          const snapshots = dbSnaps.map(db.snapToInternal)
          setData(prev => {
            const profiles = prev.profiles.map(p => {
              if (p.id !== profileId) return p
              const merged = dbProfile ? db.profileToInternal(dbProfile, p) : p
              return { ...merged, snapshots }
            })
            const u = { ...prev, profiles }
            persist(u)
            return u
          })
        } else if (dbProfile) {
          // Pas de snapshots distants mais profil existe : sync prefs seulement
          setData(prev => {
            const profiles = prev.profiles.map(p =>
              p.id === profileId ? db.profileToInternal(dbProfile, p) : p
            )
            const u = { ...prev, profiles }; persist(u); return u
          })
        }
        setDbStatus("ok")
      } catch (e) {
        console.error("Supabase init:", e)
        setDbStatus("error")
      }
    }
    init()
  }, [])

  // ── Ajout de profil ─────────────────────────────────────────────
  const addProfile = () => {
    const name = prompt("Nom du profil (ex: Papa)")
    if (!name) return
    setData(prev => {
      const np = {
        id: name.toLowerCase().replace(/\s+/g, "-"), name,
        riskProfile: "modéré",
        color: [C.amb, C.pur, C.blu2, C.tel][prev.profiles.length % 4],
        snapshots: [],
      }
      const u = { ...prev, profiles: [...prev.profiles, np] }; persist(u); return u
    })
  }

  // ── Import + persistance Supabase ──────────────────────────────
  const onImport = useCallback(async (profileId, importedAccounts) => {
    const date = new Date().toISOString().split("T")[0]

    // 1. Mise à jour état local + localStorage (synchrone → UI réactive immédiatement)
    setData(prev => {
      const profiles = prev.profiles.map(p => {
        if (p.id !== profileId) return p
        const snaps = p.snapshots || []
        const lastSnap = snaps[snaps.length - 1]

        let mergedAccounts
        if (lastSnap?.accounts?.length) {
          const importedByKey = {}
          for (const acc of importedAccounts) importedByKey[mergeKey(acc)] = acc
          const updated = lastSnap.accounts.map(oldAcc => {
            const imp = importedByKey[mergeKey(oldAcc)]
            return imp ? { ...imp, id: oldAcc.id, name: imp.name || oldAcc.name,
              totalContributed: imp.totalContributed || oldAcc.totalContributed } : oldAcc
          })
          const existingKeys = new Set(lastSnap.accounts.map(mergeKey))
          const brandNew = importedAccounts.filter(a => !existingKeys.has(mergeKey(a)))
          mergedAccounts = [...updated, ...brandNew]
        } else {
          mergedAccounts = importedAccounts
        }

        const snap = { date, accounts: mergedAccounts }
        const otherSnaps = snaps.filter(s => s.date !== date)
        return { ...p, snapshots: [...otherSnaps, snap] }
      })
      const u = { ...prev, profiles, lastUpdated: new Date().toISOString() }
      persist(u)
      return u
    })

    // 2. Persistance Supabase en arrière-plan
    const db = await getSb()
    if (db?.isConfigured()) {
      setDbStatus("syncing")
      try {
        // On lit directement depuis localStorage après persist()
        // On attend un tick pour laisser persist() terminer
        await new Promise(r => setTimeout(r, 50))
        const currentData = load()
        const prof = currentData?.profiles?.find(p => p.id === profileId)
        const lastSnap = prof?.snapshots?.find(s => s.date === date)
        const accountsToSend = lastSnap?.accounts || importedAccounts
        await db.upsertSnapshot(profileId, date, accountsToSend)
        setDbStatus("ok")
      } catch (e) {
        console.error("Supabase upsertSnapshot:", e)
        setDbStatus("error")
      }
    }

    setPage("dashboard")
  }, [])

  const onUpdateProfile = useCallback(async (updates) => {
    // 1. Mise à jour locale immédiate
    setData(prev => {
      const profiles = prev.profiles.map(p => p.id === pid ? { ...p, ...updates } : p)
      const u = { ...prev, profiles }; persist(u); return u
    })
    // 2. Sync Supabase en arrière-plan
    const db = await getSb()
    if (db?.isConfigured() && pid) {
      try {
        await db.updateProfile(pid, db.prefsToDb(updates))
      } catch (e) {
        console.error("Supabase updateProfile:", e)
      }
    }
  }, [pid])

  if(!data) return <div style={{background:C.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",...M,color:C.mut2}}>chargement…</div>

  const profile = data.profiles.find(p=>p.id===pid)||data.profiles[0]

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.tx,fontFamily:"system-ui,sans-serif"}}>
      <div style={{position:"fixed",inset:0,backgroundImage:`linear-gradient(${C.b0}50 1px,transparent 1px),linear-gradient(90deg,${C.b0}50 1px,transparent 1px)`,backgroundSize:"28px 28px",pointerEvents:"none",zIndex:0,opacity:0.7}}/>

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
          <div style={{display:"flex",gap:2,alignItems:"center"}}>
            {[["dashboard","Dashboard"],["import","Import"]].map(([p,l])=>(
              <button key={p} onClick={()=>setPage(p)} style={{...M,padding:"4px 11px",borderRadius:4,border:"none",background:page===p?`${C.acc}12`:"none",color:page===p?C.acc:C.mut2,fontSize:"0.66rem",cursor:"pointer",letterSpacing:"0.04em"}}>{l}</button>
            ))}
            {dbStatus==="syncing" && <span style={{...M,fontSize:"0.55rem",color:C.mut3,marginLeft:6}}>⟳ sync</span>}
            {dbStatus==="ok"      && <span style={{...M,fontSize:"0.55rem",color:C.acc3, marginLeft:6}}>✓ db</span>}
            {dbStatus==="error"   && <span style={{...M,fontSize:"0.55rem",color:C.amb2, marginLeft:6}}>⚠ local</span>}
          </div>
        </div>
      </nav>

      <div style={{position:"relative",zIndex:1}}>
        {page==="import"
          ? <ImportPage profiles={data.profiles} onImport={onImport}/>
          : <Dashboard profile={profile} snapshots={profile?.snapshots||[]} onUpdateProfile={onUpdateProfile}/>
        }
      </div>
    </div>
  )
}
