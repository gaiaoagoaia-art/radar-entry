// Token Launch Radar — the valuation model.
//
// The question this board answers: if a pre-token protocol issued a token today, what would the
// market plausibly pay for it? The model answers with the snapshot's own evidence, in three parts:
//
//   1. COMPARABLES. Protocols that already have a token reveal what the market pays per dollar of
//      TVL, and the price differs sharply by category: in this snapshot the median market-cap/TVL
//      multiple is about 0.04x for liquid staking and about 1.2x for cross-chain bridges. The
//      multiple a protocol is priced with comes from a three-step hierarchy, and every step names
//      the peers behind it:
//        a. its own category's median, when the category has at least three tokenized peers;
//        b. its category FAMILY's median, when the category is thin but its family — the set of
//           categories running the same business (vault curators and allocators; the staking
//           family; the derivatives family; see FAMILIES below) — has at least three;
//        c. the market-wide median, only when neither the category nor its family can be read.
//      Medians and quartiles, never means: one 400x prediction-market token or one 69x exchange
//      would poison an average, and this snapshot has both. A pre-token protocol's base value is
//      its TVL times the resolved multiple — the value of a typical tokenized peer.
//   2. A RANGE, NOT JUST A POINT. The peers' middle half (their first-to-third quartile
//      multiples) becomes the row's value range: low = TVL x Q1, high = TVL x Q3, with the same
//      momentum and longevity factors applied. Each row also carries a confidence grade from the
//      peer count and the spread: many peers agreeing tightly is high confidence; few peers
//      spread widely is low, and the dashboard says so on the row.
//   3. MOMENTUM. A protocol whose TVL grew over the last seven days is gaining users faster than
//      its peers; one that is shrinking is losing them. The base is scaled by the 7-day change,
//      clamped so one wild week cannot dominate: -40%..+80% maps to a 0.76x..1.48x factor.
//   4. LONGEVITY. A protocol that has run for years without a token has survived audits, bear
//      markets and exploits that killed younger rivals. Age scales the base from 0.75x (brand new)
//      to 1.25x (four years or more), linearly.
//
//   implied_value = TVL x peer_multiple x momentum_factor x longevity_factor
//
// No protocol name is ever special-cased: the same function scores every row, and the dashboard
// shows every input, factor, peer and quartile for every row, so a reader can check the arithmetic.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** One tokenized peer behind a multiple: its name, its symbol, and what the market pays for it. */
export interface CompPeer {
  name: string;
  symbol: string | null;
  multiple: number;
  mcap_usd: number;
}

/**
 * One comparables group's evidence: a category's own peers, or a family of categories pooled.
 * The quartiles are the peers' multiples' middle half — the spread the value range comes from.
 */
export interface CompGroup {
  category: string;
  peers: number;
  median_multiple: number;
  q1_multiple: number;
  q3_multiple: number;
  peer_list: CompPeer[];
}

/** Where a row's multiple came from: its own category, its category family, or the whole market. */
export type MultipleSource = 'category' | 'family' | 'market';

/** How much to trust a row's multiple: peer count and spread, graded. */
export type Confidence = 'high' | 'medium' | 'low';

/** The model's constants, stated in the dashboard so a reader can re-run the arithmetic. */
export interface ModelConstants {
  min_peers: number;
  momentum_weight: number;
  momentum_floor_pct: number;
  momentum_cap_pct: number;
  longevity_floor: number;
  longevity_range: number;
  longevity_days: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  min_peers: 3,
  momentum_weight: 0.6,
  momentum_floor_pct: -40,
  momentum_cap_pct: 80,
  longevity_floor: 0.75,
  longevity_range: 0.5,
  longevity_days: 1460,
  unknown_age_days: 365,
};

export const MODEL_VERSION = 'comps-2';

/** How many live-token protocols the comparables view carries, by market cap. */
export const LIVE_ROWS = 30;

/** A farm step before it is flattened to one string: the action, its cost, its time. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row, with the model's working shown. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  /** The value range from the peer set's middle half, and where the implied value would rank live. */
  implied_low_usd: number;
  implied_high_usd: number;
  live_rank: number;
  thesis: string;
  model: {
    category_multiple: number;
    comp_peers: number;
    multiple_source: MultipleSource;
    multiple_group: string;
    q1_multiple: number;
    q3_multiple: number;
    confidence: Confidence;
    momentum_pct: number;
    momentum_factor: number;
    longevity_factor: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one board row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  watchlist: boolean;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  live_rank: number;
  thesis: string;
  category_multiple: number;
  comp_peers: number;
  multiple_source: MultipleSource;
  multiple_group: string;
  confidence: Confidence;
  momentum_factor: number;
  longevity_factor: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own figures. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  multiple: number | null;
  symbol: string | null;
}

/** Everything the dashboard needs: the board, the live comparables, and the model behind them. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  global_multiple: number;
  global_q1: number;
  global_q3: number;
  live_total: number;
  comps: CompGroup[];
  families: CompGroup[];
  universe_size: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A quartile of a non-empty list: the median of its lower (q=0.25) or upper (q=0.75) half. */
function quartile(values: number[], q: 0.25 | 0.75): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const half = sorted.length % 2 === 1 ? (q === 0.25 ? sorted.slice(0, mid) : sorted.slice(mid + 1)) : (q === 0.25 ? sorted.slice(0, mid) : sorted.slice(mid));
  return half.length > 0 ? median(half) : sorted[mid]!;
}

/**
 * Category families: categories that run the same business, pooled when one of them is too thin
 * to read on its own. A curator's vault, an onchain allocator and a yield aggregator all earn fees
 * on capital other people deposit into strategies they run, so the market prices them alike; the
 * staking family all wrap a chain's staking yield; the derivatives family all sell leverage or
 * convexity; lending, CDP and DEX families likewise share one revenue shape. A category not named
 * here has no family and falls straight to the market median when it is thin.
 */
export const FAMILIES: Record<string, string> = {
  'Risk Curators': 'Managed vaults & allocators',
  'Onchain Capital Allocator': 'Managed vaults & allocators',
  'Yield Aggregator': 'Managed vaults & allocators',
  'Collateral Markets': 'Managed vaults & allocators',
  'Liquid Staking': 'Staking & restaking',
  'Liquid Restaking': 'Staking & restaking',
  'Restaking': 'Staking & restaking',
  'Staking Pool': 'Staking & restaking',
  'Derivatives': 'Derivatives & options',
  'Options': 'Derivatives & options',
  'Options Vault': 'Derivatives & options',
  'Interest Rate Derivatives': 'Derivatives & options',
  'Lending': 'Lending & CDP',
  'Uncollateralized Lending': 'Lending & CDP',
  'CDP': 'Lending & CDP',
  'CDP Manager': 'Lending & CDP',
  'Dexs': 'DEX & liquidity',
  'Liquidity Manager': 'DEX & liquidity',
  'Yield': 'Yield & farming',
  'Farm': 'Yield & farming',
  'Leveraged Farming': 'Yield & farming',
};

/** The resolved peer set behind one category's multiple. */
export interface ResolvedMultiple {
  multiple: number;
  q1: number;
  q3: number;
  peers: number;
  source: MultipleSource;
  group: string;
}

/**
 * A confidence grade from a peer set. Two things make a median trustworthy: how many peers stand
 * behind it, and how far apart those peers are (the middle half's width against the median).
 * Many peers in a tight spread is high; a large peer set is medium even when its peers disagree —
 * a median of fifteen is a stable centre of a genuinely dispersed market; a thin set, or a
 * mid-size set spread very wide, is low, and the row says so.
 */
export function confidenceFor(peers: number, medianMultiple: number, q1: number, q3: number): Confidence {
  const spread = medianMultiple > 0 ? (q3 - q1) / medianMultiple : Number.POSITIVE_INFINITY;
  if (peers >= 8 && spread <= 3) return 'high';
  if (peers >= 8 || (peers >= 4 && spread <= 5.5)) return 'medium';
  return 'low';
}

/** A whole day count from `listedAt` to `asOf`, clamped at zero; null when either date is absent. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/**
 * Board hygiene, extending the watchlist's own rules to the whole board. A bridge entry in this
 * snapshot is a pipe for an asset that already exists (wrapped BTC, bridged USDT): its TVL is the
 * asset's value in transit, not a protocol waiting to issue a token, so Bridge and Canonical
 * Bridge stay off the board, as do wrapped/staked products (a whole word in the name), products
 * that carry an exchange's name, exchanges themselves, and versioned pools of another protocol.
 */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Whether a protocol is one the board may rank: pre-token, and a plausible token issuer. */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category === 'CEX' || p.category === 'Bridge' || p.category === 'Canonical Bridge') return false;
  if (VERSIONED.test(p.name) || WRAPPED_WORD.test(p.name) || EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/** One peer set's summary: median, quartiles, and the peers themselves, largest market cap first. */
function summarize(peers: { p: SnapshotProtocol; multiple: number }[]): { median: number; q1: number; q3: number; peerList: CompPeer[] } {
  const values = peers.map((x) => x.multiple);
  const peerList = [...peers]
    .sort((a, b) => (b.p.mcap_usd ?? 0) - (a.p.mcap_usd ?? 0))
    .map((x) => ({ name: x.p.name, symbol: x.p.symbol, multiple: round4(x.multiple), mcap_usd: x.p.mcap_usd ?? 0 }));
  return { median: median(values), q1: quartile(values, 0.25), q3: quartile(values, 0.75), peerList };
}

/**
 * The comparables table: for every category and every family, the median market-cap/TVL multiple
 * of its tokenized protocols and the middle half around it, plus the market-wide figures used
 * when neither a category nor its family has enough peers to read. A peer is a protocol with a
 * recorded market cap and TVL above zero; a zero or missing market cap is no evidence and is out.
 */
export function buildComps(snapshot: Snapshot, model: ModelConstants = MODEL): { comps: CompGroup[]; families: CompGroup[]; globalMultiple: number; globalQ1: number; globalQ3: number; multipleFor: Map<string, ResolvedMultiple> } {
  const byCategory = new Map<string, { p: SnapshotProtocol; multiple: number }[]>();
  const byFamily = new Map<string, { p: SnapshotProtocol; multiple: number }[]>();
  const all: { p: SnapshotProtocol; multiple: number }[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const multiple = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(multiple) || multiple <= 0) continue;
    const entry = { p, multiple };
    all.push(entry);
    const key = p.category ?? 'Uncategorized';
    const list = byCategory.get(key);
    if (list === undefined) byCategory.set(key, [entry]);
    else list.push(entry);
    const family = FAMILIES[key];
    if (family !== undefined) {
      const flist = byFamily.get(family);
      if (flist === undefined) byFamily.set(family, [entry]);
      else flist.push(entry);
    }
  }
  const globalStats = all.length > 0 ? summarize(all) : { median: 0.2, q1: 0.05, q3: 0.6, peerList: [] };
  const toGroup = (category: string, peers: { p: SnapshotProtocol; multiple: number }[]): CompGroup => {
    const s = summarize(peers);
    return { category, peers: peers.length, median_multiple: round4(s.median), q1_multiple: round4(s.q1), q3_multiple: round4(s.q3), peer_list: s.peerList };
  };
  const comps: CompGroup[] = [];
  const families: CompGroup[] = [];
  const catStats = new Map<string, ReturnType<typeof summarize>>();
  const famStats = new Map<string, ReturnType<typeof summarize>>();
  for (const [category, peers] of byCategory) {
    catStats.set(category, summarize(peers));
    if (peers.length >= model.min_peers) comps.push(toGroup(category, peers));
  }
  for (const [family, peers] of byFamily) {
    famStats.set(family, summarize(peers));
    if (peers.length >= model.min_peers) families.push(toGroup(family, peers));
  }
  comps.sort((a, b) => b.median_multiple - a.median_multiple);
  families.sort((a, b) => b.median_multiple - a.median_multiple);
  const multipleFor = new Map<string, ResolvedMultiple>();
  for (const [category, peers] of byCategory) {
    const own = catStats.get(category)!;
    if (peers.length >= model.min_peers) {
      multipleFor.set(category, { multiple: own.median, q1: own.q1, q3: own.q3, peers: peers.length, source: 'category', group: category });
      continue;
    }
    const family = FAMILIES[category];
    const famPeers = family === undefined ? undefined : byFamily.get(family);
    if (family !== undefined && famPeers !== undefined && famPeers.length >= model.min_peers) {
      const fs = famStats.get(family)!;
      multipleFor.set(category, { multiple: fs.median, q1: fs.q1, q3: fs.q3, peers: famPeers.length, source: 'family', group: family });
    }
  }
  return { comps, families, globalMultiple: globalStats.median, globalQ1: globalStats.q1, globalQ3: globalStats.q3, multipleFor };
}

/** The factors, the implied value and its range for one protocol under `model` and the comps table. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  multipleFor: Map<string, ResolvedMultiple>,
  globalStats: { multiple: number; q1: number; q3: number; peers: number },
): { implied: number; low: number; high: number; resolved: ResolvedMultiple; confidence: Confidence; momentumPct: number; momentumFactor: number; longevityFactor: number; age: number | null } {
  const comp = multipleFor.get(protocol.category ?? 'Uncategorized');
  const resolved: ResolvedMultiple = comp === undefined
    ? { multiple: globalStats.multiple, q1: globalStats.q1, q3: globalStats.q3, peers: globalStats.peers, source: 'market', group: 'All tokenized protocols' }
    : comp;
  const age = ageDays(asOf, protocol.listed_at);
  const rawMomentum = finite(protocol.change_7d, 0);
  const momentumPct = Math.min(model.momentum_cap_pct, Math.max(model.momentum_floor_pct, rawMomentum));
  const momentumFactor = 1 + (momentumPct / 100) * model.momentum_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const longevityFactor = model.longevity_floor + (Math.min(Math.max(ageForModel, 0), model.longevity_days) / model.longevity_days) * model.longevity_range;
  const at = (multiple: number): number => Math.max(1, Math.round(protocol.tvl_usd * multiple * momentumFactor * longevityFactor));
  const implied = at(resolved.multiple);
  const low = Math.min(implied, at(resolved.q1));
  const high = Math.max(implied, at(resolved.q3));
  return { implied, low, high, resolved, confidence: confidenceFor(resolved.peers, resolved.multiple, resolved.q1, resolved.q3), momentumPct, momentumFactor, longevityFactor, age };
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The board's headline figures. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** A whole-dollar figure in words, for the thesis lines: $2.75B, $312M, $940K. */
function moneyWords(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

/**
 * A row's farm thesis: one line of true statements about this protocol, assembled from its record
 * and its standing among the board's pre-token protocols in its category — its size rank there,
 * its week's direction when the week was decisive, and how long it has run with no token. Every
 * clause is computed; nothing is written by hand for any name.
 */
export function thesisFor(p: SnapshotProtocol, age: number | null, categoryTvlRank: number, categoryCount: number, watchlist: boolean): string {
  const clauses: string[] = [];
  const cat = p.category ?? 'Uncategorized';
  if (categoryCount >= 3 && categoryTvlRank === 1) clauses.push(`the largest pre-token ${cat} protocol by TVL at ${moneyWords(p.tvl_usd)}`);
  else if (categoryCount >= 3 && categoryTvlRank <= 3) clauses.push(`#${categoryTvlRank} pre-token ${cat} protocol by TVL at ${moneyWords(p.tvl_usd)}`);
  else clauses.push(`a pre-token ${cat} protocol with ${moneyWords(p.tvl_usd)} of TVL`);
  if (p.change_7d !== null && p.change_7d >= 10) clauses.push(`and TVL up ${p.change_7d.toFixed(1)}% in seven days — growth a launch would be sold into`);
  else if (p.change_7d !== null && p.change_7d <= -10) clauses.push(`but TVL is down ${Math.abs(p.change_7d).toFixed(1)}% in seven days, so the plan below is sized defensively`);
  if (age !== null && age >= 730) clauses.push(`; it has run ${(age / 365.25).toFixed(1)} years with no token, the long tokenless record this model pays a premium for`);
  else if (age !== null && age < 180) clauses.push(`; it is young — tracked for ${age} days — so its record is short and its range deserves the doubt the confidence grade shows`);
  if (watchlist) clauses.push(`. It sits on the house watchlist, over the $50M floor`);
  const line = `${clauses.join('')}.`;
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/**
 * The protocols the board ranks, strongest first, with ranks 1..n: every watchlist slug, plus every
 * other rankable pre-token protocol in the snapshot — the early finds below the floor are the
 * radar's reason to exist, so the board carries all of them, not a sample.
 */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const watchlist = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const { multipleFor, globalMultiple, globalQ1, globalQ3 } = buildComps(snapshot, model);
  const peerCount = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.tvl_usd > 0 && p.mcap_usd / p.tvl_usd > 0).length;
  const globalStats = { multiple: globalMultiple, q1: globalQ1, q3: globalQ3, peers: peerCount };
  // Where an implied value would sit among the market caps that actually trade today.
  const liveMcaps = snapshot.protocols
    .filter((p) => p.mcap_usd !== null)
    .map((p) => p.mcap_usd!)
    .sort((a, b) => b - a);
  const liveRankOf = (value: number): number => {
    let lo = 0;
    let hi = liveMcaps.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (liveMcaps[mid]! > value) lo = mid + 1;
      else hi = mid;
    }
    return lo + 1;
  };
  // Each protocol's TVL rank among the board's pre-token protocols in its own category.
  const byCategory = new Map<string, SnapshotProtocol[]>();
  for (const p of chosen.values()) {
    const key = p.category ?? 'Uncategorized';
    const list = byCategory.get(key);
    if (list === undefined) byCategory.set(key, [p]);
    else list.push(p);
  }
  const catRank = new Map<string, { rank: number; count: number }>();
  for (const list of byCategory.values()) {
    const sorted = [...list].sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1));
    sorted.forEach((p, i) => catRank.set(p.slug, { rank: i + 1, count: sorted.length }));
  }
  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, multipleFor, globalStats);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => {
    const standing = catRank.get(s.p.slug) ?? { rank: 1, count: 1 };
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token' as const,
      watchlist: watchlist.has(s.p.slug),
      age_days: s.age,
      implied_value_usd: s.implied,
      implied_low_usd: s.low,
      implied_high_usd: s.high,
      live_rank: liveRankOf(s.implied),
      thesis: thesisFor(s.p, s.age, standing.rank, standing.count, watchlist.has(s.p.slug)),
      model: {
        category_multiple: round4(s.resolved.multiple),
        comp_peers: s.resolved.peers,
        multiple_source: s.resolved.source,
        multiple_group: s.resolved.group,
        q1_multiple: round4(s.resolved.q1),
        q3_multiple: round4(s.resolved.q3),
        confidence: s.confidence,
        momentum_pct: s.momentumPct,
        momentum_factor: round4(s.momentumFactor),
        longevity_factor: round4(s.longevityFactor),
        age_days: s.age,
      },
      farm_steps: farmSteps(s.p, s.age).map(stepText),
    };
  });
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Keep the position open and re-check it weekly.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** What one transaction roughly costs on the protocol's first chain, in November 2026 terms. */
function gasFor(chain: string): string {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 'about $6-12 of gas on Ethereum mainnet';
  if (c.includes('solana')) return 'under $0.05 of fees on Solana';
  if (c.includes('bitcoin')) return 'about $1-3 of network fees';
  return 'about $0.10-1 of gas on this chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 500;
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 250_000_000) return 150;
  if (p.tvl_usd >= 50_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category playbook: the two core actions and the recurring one, in a farmer's words. */
function playbook(p: SnapshotProtocol, capital: number, chain: string): { first: string; second: string; weekly: string; risk: string } {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return {
      first: `Supply $${capital} of USDC as collateral in ${name} on ${chain}; supplying is the action points programs count first.`,
      second: `Borrow about $${Math.round(capital / 3)} of a second stablecoin against the position and re-supply it once, keeping the loan-to-value under 40% so a normal price swing cannot liquidate you.`,
      weekly: `Repay and re-borrow a small slice, or add and remove a small supply, so the wallet shows fresh lending activity.`,
      risk: `Liquidation is the risk here: check the position's health factor weekly and top up collateral if it drifts toward 1.2.`,
    };
  }
  if (c.includes('curator') || c.includes('allocator') || c.includes('aggregator')) {
    return {
      first: `Deposit $${capital} of USDC into ${name}'s flagship vault on ${chain}; a curator's vault shares in the depositing wallet are the position its points and fee-sharing programs count.`,
      second: `Read the vault's allocation list before adding more: note which markets the curator lends into, then split a smaller slice into a second ${name} vault with a different risk profile so the wallet shows a deliberate choice, not one click.`,
      weekly: `Check the vault's APY and its allocation changes each week, and harvest or restake any vault rewards; curators reward depositors who stay through several distribution snapshots.`,
      risk: `Curator risk is the risk here: the vault is only as safe as the markets the curator allocates to, so withdraw if allocations drift into markets you would not lend to yourself.`,
    };
  }
  if (c.includes('basis')) {
    return {
      first: `Deposit $${capital} of USDC into ${name}'s basis vault on ${chain}; the vault runs the delta-neutral trade (spot against a short perp) and the deposit is the position that earns the funding harvest.`,
      second: `Leave the deposit untouched for a full funding cycle and read the vault's reported breakdown once — spot leg, perp leg, funding earned — so you know what you actually own before adding a second, smaller deposit.`,
      weekly: `Check the vault's yield against current funding rates each week; a basis vault that keeps paying while funding is negative is paying out of reserves, which is your signal to leave.`,
      risk: `Funding can flip and stay negative, and the perp leg sits on an exchange: counterparty and funding risk are the price of this yield, so keep the position at farm size.`,
    };
  }
  if (c === 'chain') {
    return {
      first: `Bridge $${capital} of USDC or ETH from Ethereum to ${name} using its official bridge page, then hold a small amount of the chain's gas token in the same wallet; a funded, active address is what chain incentive programs count.`,
      second: `Use two or three of the chain's native apps in the first week — a swap on its main DEX and a deposit in its main lending market — so the wallet reads as a real user of the network, not a bridged-and-idle address.`,
      weekly: `Make a handful of real transactions each week (a swap, a claim, a vote) and keep the gas balance topped up; chains reward sustained activity across snapshots, not one busy day.`,
      risk: `Bridge and new-chain risk are the risks here: bridges are the most-attacked contracts in crypto, so cross with farm size only and verify the bridge address on the chain's official site.`,
    };
  }
  if (c.includes('dex') || c.includes('amm') || c.includes('exchange') || c.includes('liquidity')) {
    return {
      first: `Swap about $${Math.round(capital / 2)} through ${name}'s main market on ${chain} so the wallet has real trading volume with the protocol.`,
      second: `Provide the remaining $${capital - Math.round(capital / 2)} as liquidity in ${name}'s deepest stable or blue-chip pool and keep the LP position open.`,
      weekly: `Make one small swap each week and re-check the LP range; volume plus liquidity is what DEX reward programs usually weigh.`,
      risk: `Impermanent loss is the risk here: a stable or blue-chip pair keeps it small while the position qualifies.`,
    };
  }
  if (c.includes('bridge')) {
    return {
      first: `Bridge $${capital} of USDC from Ethereum to ${chain} through ${name}; a completed bridge transfer is the protocol's core action.`,
      second: `Use the bridged funds in one app on the far chain (a swap or a deposit), then bridge a smaller amount back a week later so both directions are on record.`,
      weekly: `Bridge one small transfer each week in either direction; steady route usage reads as a real user, not a one-off.`,
      risk: `Bridge risk is real: keep amounts at farm size, confirm the destination address on the official interface, and never bridge funds you cannot afford to have delayed.`,
    };
  }
  if (c.includes('staking') || c.includes('restak')) {
    return {
      first: `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the liquid receipt token in the same wallet.`,
      second: `Use the receipt token once in a partner app ${name} lists (a lending market or a DEX pool), which is the activity restaking programs tend to reward.`,
      weekly: `Claim or compound any staking rewards each week so the wallet shows an active staking position, not a parked one.`,
      risk: `Slashing and depeg are the risks here: the receipt token can trade below the staked asset, so size the position as a farm, not a savings account.`,
    };
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) {
    return {
      first: `Deposit $${capital} of USDC as margin on ${name} and open one small position (about $${Math.round(capital / 2)} of notional) with a stop, then close it the same day.`,
      second: `Leave the remaining margin in the account and place one limit order a week so the account shows considered, recurring trading.`,
      weekly: `Trade one small hedged position each week; consistent modest volume is what derivatives points programs count.`,
      risk: `Leverage is the risk here: keep notional near the deposit, use a stop on every position, and treat margin as money that can go to zero.`,
    };
  }
  if (c.includes('rwa') || c.includes('real world')) {
    return {
      first: `Complete ${name}'s onboarding or KYC if it asks for it, then mint $${capital} of its yield asset on ${chain}.`,
      second: `Hold the asset in the minting wallet and, if ${name} offers one, deposit it into the protocol's own vault for a second layer of recorded activity.`,
      weekly: `Check the asset's reported yield and NAV each week and keep any distribution in the wallet.`,
      risk: `Redemption windows are the risk here: RWA assets can take days to exit, so farm only with money that can wait.`,
    };
  }
  if (c.includes('prediction')) {
    return {
      first: `Fund $${capital} on ${name} and take one position in a liquid, near-dated market you actually have a view on.`,
      second: `Add a second small position in a different category of market so the account reads as a regular bettor, not a single punt.`,
      weekly: `Place one or two small positions each week and let some settle; settled history is what these platforms can verify.`,
      risk: `Every position can go to zero: bet farm size only, and never chase a loss to look active.`,
    };
  }
  if (c.includes('insurance')) {
    return {
      first: `Buy $${capital} of cover from ${name} on ${chain} for a position you really hold (a lending deposit or an LP), for the longest term it offers.`,
      second: `If ${name} lets members stake into its capital pool, stake a smaller amount there too, since underwriting is the protocol's core action.`,
      weekly: `Renew or extend the cover before it lapses so the policy history has no gaps.`,
      risk: `Cover pays only on the events the policy names: read the exclusions before counting the position as protected.`,
    };
  }
  if (c.includes('yield') || c.includes('farm') || c.includes('vault') || c.includes('curator') || c.includes('allocator')) {
    return {
      first: `Deposit $${capital} into ${name}'s flagship vault on ${chain} and keep the vault shares in the depositing wallet.`,
      second: `Move a smaller slice into a second ${name} vault with a different strategy, so the wallet shows deliberate allocation, not one click.`,
      weekly: `Rebalance or top up one vault each week; vault programs reward depositors who stay through several distribution snapshots.`,
      risk: `Strategy risk is the risk here: a vault is only as safe as what it holds, so read the strategy page before depositing more.`,
    };
  }
  return {
    first: `Deposit $${capital} of USDC into ${name} on ${chain} through its main app and keep the position open; a live deposit is the action every points program counts first.`,
    second: `Make one more core action ${name} offers — a swap, a vote, a second deposit on another of its chains (${p.chains.slice(0, 3).join(', ') || chain}) — so the wallet shows real use, not a parked deposit.`,
    weekly: `Repeat one small core action each week; steady activity across several snapshots is what separates farmers from one-day visitors.`,
    risk: `Smart-contract risk is the risk here: farm size only, and withdraw if the protocol pauses deposits or its audits are called into question.`,
  };
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record — its category's playbook, its first chain's fees, its TVL tier
 * and its age — never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const gas = gasFor(chain);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const book = playbook(p, capital, chain);
  return [
    {
      text: `Start with a fresh wallet that holds only the funds you plan to farm ${p.name} with, and keep its seed phrase offline; one wallet per protocol keeps a bad approval from reaching your main funds.`,
      cost: 'nothing to create, and never pay anyone to set one up',
      time: '5 minutes',
    },
    {
      text: book.first,
      cost: `$${capital} of capital and ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: book.second,
      cost: `${gas} for the extra transactions`,
      time: '15 minutes',
    },
    {
      text: book.weekly,
      cost: `${gas} a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity appears in more than one weekly snapshot; most airdrop and points rules quietly require exactly that.`,
      cost: `the $${capital} stays in the position for the whole window`,
      time: `${hold} days`,
    },
    {
      text: book.risk,
      cost: '10 minutes of checking a week, and never a fee to anyone',
      time: '10 minutes a week',
    },
    {
      text: `Before you withdraw, open ${p.name}'s own points or rewards page from the link on its official site and claim only there; then log the wallet, the dates and every transaction hash in a farm log so the position can be repeated or unwound.`,
      cost: 'no fee to check a claim, and never pay to claim',
      time: '10 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, with the multiple the market actually pays for each. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      multiple: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
      symbol: p.symbol,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    watchlist: row.watchlist,
    implied_value_usd: row.implied_value_usd,
    implied_low_usd: row.implied_low_usd,
    implied_high_usd: row.implied_high_usd,
    live_rank: row.live_rank,
    thesis: row.thesis,
    category_multiple: row.model.category_multiple,
    comp_peers: row.model.comp_peers,
    multiple_source: row.model.multiple_source,
    multiple_group: row.model.multiple_group,
    confidence: row.model.confidence,
    momentum_factor: row.model.momentum_factor,
    longevity_factor: row.model.longevity_factor,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const { comps, families, globalMultiple, globalQ1, globalQ3 } = buildComps(snapshot, model);
  const early = board.filter((r) => !r.watchlist).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    global_multiple: round4(globalMultiple),
    global_q1: round4(globalQ1),
    global_q3: round4(globalQ3),
    live_total: snapshot.protocols.filter((p) => p.mcap_usd !== null).length,
    comps,
    families,
    universe_size: snapshot.protocols.length,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, farm steps, values. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slugs: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100 || board.length > 4000) return `the board has ${board.length} rows, outside 100..4000`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  const byRank = [...board].sort((a, b) => a.rank - b.rank);
  for (let i = 1; i < byRank.length; i++) if (byRank[i]!.implied_value_usd > byRank[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && byRank[0]!.implied_value_usd === byRank[byRank.length - 1]!.implied_value_usd) {
    return 'every row shares one implied value: a board that ranks nothing by value is not a ranking';
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters`;
    }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) {
      return `${r.slug} has implied value ${r.implied_value_usd}`;
    }
    if (!(r.implied_low_usd >= 1 && r.implied_low_usd <= r.implied_value_usd && r.implied_value_usd <= r.implied_high_usd)) {
      return `${r.slug} has a broken value range ${r.implied_low_usd}..${r.implied_high_usd} around ${r.implied_value_usd}`;
    }
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
