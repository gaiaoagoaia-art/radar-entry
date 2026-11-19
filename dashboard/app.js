// Token Launch Radar — the page's behaviour. Everything renders from window.RADAR, the dataset
// main.ts wrote beside this page from the sealed snapshot: no fetch, no network, no framework.
// Views are addressable by hash so a reader (and a screenshot) can land on them directly:
//   #/board                 the ranked board
//   #/filter/<Category>     the board filtered to one category
//   #/detail/<slug>         one protocol's full record and farm plan
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) return;

  var state = { seg: 'all', q: '', category: '', chain: '', sort: 'rank', detail: null };

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    if (n == null) return '—';
    var abs = Math.abs(n);
    if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function moneyFull(n) {
    if (n == null) return '—';
    return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function pct(n) {
    if (n == null) return '<span class="flat">n/a</span>';
    var cls = n > 0.05 ? 'up' : n < -0.05 ? 'down' : 'flat';
    var arrow = n > 0.05 ? '▲' : n < -0.05 ? '▼' : '■';
    return '<span class="' + cls + '">' + arrow + ' ' + (n > 0 ? '+' : '') + n.toFixed(1) + '%</span>';
  }
  function ageText(days) {
    if (days == null) return 'unknown';
    if (days >= 730) return (days / 365.25).toFixed(1) + ' yrs';
    if (days >= 60) return Math.round(days / 30.4) + ' mo';
    return days + ' d';
  }
  function mult(n) { return n == null ? '—' : n.toFixed(3).replace(/0$/, '') + '×'; }

  /* ---------- header + model panel ---------- */
  var totalImplied = DATA.rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0);
  el('stats').innerHTML =
    '<div><dt>Snapshot</dt><dd>' + esc(DATA.as_of) + '</dd></div>' +
    '<div><dt>Protocols scanned</dt><dd>' + DATA.universe_size + '</dd></div>' +
    '<div><dt>On the board</dt><dd>' + DATA.board_size + '</dd></div>' +
    '<div><dt>Watchlist covered</dt><dd>' + DATA.watchlist_size + ' / ' + DATA.watchlist_size + '</dd></div>' +
    '<div><dt>Board implied value</dt><dd>' + money(totalImplied) + '</dd></div>';
  el('model-tag').textContent = 'model ' + DATA.model_version + ' · market median ' + mult(DATA.global_multiple) + ' · backtest: the printed range held ' + DATA.backtest.hit_rate_pct + '% of live tokens';
  el('formula').textContent = 'implied value  =  blend of  [ TVL × peer multiple ]  and  [ the market size curve on TVL ],  weighted by confidence,  ×  momentum factor  ×  longevity factor';
  if (DATA.comps.length > 1) {
    var hi = DATA.comps[0];
    var lo = DATA.comps[DATA.comps.length - 1];
    el('fact-comp').textContent = lo.median_multiple.toFixed(2) + '× for ' + lo.category.toLowerCase() + ' to ' + hi.median_multiple.toFixed(2) + '× for ' + hi.category.toLowerCase();
  }
  el('fact-reg').textContent = 'over ' + DATA.regression.n + ' tokenized protocols the fit has slope ' + DATA.regression.slope.toFixed(2) +
    ' (R² ' + DATA.regression.r2.toFixed(2) + '): value grows slower than TVL, so size alone argues for less than proportionality';
  var bt = DATA.backtest;
  el('fact-backtest').textContent = 'Priced backwards over the snapshot\u2019s ' + bt.n + ' live tokens, the printed range held ' + bt.hit_rate_pct +
    '% of the time — ' + bt.grades.high.hit_rate_pct + '% of high-grade rows, ' + bt.grades.medium.hit_rate_pct + '% of medium, ' + bt.grades.low.hit_rate_pct +
    '% of low — and the typical point estimate missed by \u00d7' + bt.median_error_factor.toFixed(1) + ', which is why every row leads with its range, not its point.';
  function compsTable(groups) {
    var html = '<thead><tr><th>Group</th><th class="num">Tokenized peers</th><th class="num">Median mcap / TVL</th><th class="num">Middle half (Q1–Q3)</th><th>Largest peers behind it</th></tr></thead><tbody>';
    groups.forEach(function (c) {
      var top = c.peer_list.slice(0, 3).map(function (p) { return esc(p.name) + ' ' + mult(p.multiple); }).join(' · ');
      html += '<tr><td>' + esc(c.category) + '</td><td class="num">' + c.peers + '</td><td class="num">' + mult(c.median_multiple) + '</td>' +
        '<td class="num">' + mult(c.q1_multiple) + ' – ' + mult(c.q3_multiple) + '</td><td class="peers">' + top + '</td></tr>';
    });
    return html + '</tbody>';
  }
  el('comps').innerHTML = compsTable(DATA.comps);
  el('families').innerHTML = compsTable(DATA.families);
  el('foot-note').textContent = 'Snapshot: ' + DATA.source + ' · Radar model ' + DATA.model_version + ' · Implied values are the model\u2019s claims about hypothetical tokens, not predictions or advice.';

  /* ---------- filters ---------- */
  var cats = {};
  var chains = {};
  DATA.rows.forEach(function (r) {
    if (r.category) cats[r.category] = 1;
    r.chains.forEach(function (c) { chains[c] = 1; });
  });
  function fillSelect(node, values, allLabel) {
    var html = '<option value="">' + allLabel + '</option>';
    values.sort().forEach(function (v) { html += '<option value="' + esc(v) + '">' + esc(v) + '</option>'; });
    node.innerHTML = html;
  }
  fillSelect(el('f-category'), Object.keys(cats), 'All categories');
  fillSelect(el('f-chain'), Object.keys(chains), 'All chains');

  /* ---------- board rendering ---------- */
  function visibleRows() {
    var rows = DATA.rows.slice();
    if (state.seg === 'watchlist') rows = rows.filter(function (r) { return r.watchlist; });
    if (state.seg === 'early') rows = rows.filter(function (r) { return !r.watchlist; });
    if (state.category) rows = rows.filter(function (r) { return r.category === state.category; });
    if (state.chain) rows = rows.filter(function (r) { return r.chains.indexOf(state.chain) >= 0; });
    if (state.q) {
      var q = state.q.toLowerCase();
      rows = rows.filter(function (r) {
        return r.name.toLowerCase().indexOf(q) >= 0 || r.slug.indexOf(q) >= 0 ||
          (r.category || '').toLowerCase().indexOf(q) >= 0 ||
          r.chains.some(function (c) { return c.toLowerCase().indexOf(q) >= 0; });
      });
    }
    var confScore = { high: 0, medium: 1, low: 2 };
    var by = {
      rank: function (a, b) { return a.rank - b.rank; },
      implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      change: function (a, b) { return (b.change_7d == null ? -1e9 : b.change_7d) - (a.change_7d == null ? -1e9 : a.change_7d); },
      age: function (a, b) { return (b.age_days == null ? -1 : b.age_days) - (a.age_days == null ? -1 : a.age_days); },
      confidence: function (a, b) { return (confScore[a.confidence] - confScore[b.confidence]) || (b.implied_value_usd - a.implied_value_usd); }
    };
    rows.sort(by[state.sort] || by.rank);
    return rows;
  }

  function boardHtml(rows) {
    if (rows.length === 0) return '<tbody><tr><td class="empty" colspan="8">No protocol matches that filter. Clear the search or pick another category.</td></tr></tbody>';
    var html = '<thead><tr><th class="num">Rank</th><th>Protocol</th><th>Category</th><th>Chains</th><th class="num">TVL</th><th class="num">7 days</th><th class="num">Age</th><th class="num">Implied value</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr data-slug="' + esc(r.slug) + '" tabindex="0">' +
        '<td class="num rank">#' + r.rank + '</td>' +
        '<td class="name-cell">' + esc(r.name) + (r.watchlist ? '<span class="watch">◆ watchlist</span>' : '') + '<span class="slug">' + esc(r.slug) + '</span></td>' +
        '<td class="cat">' + esc(r.category || 'Uncategorized') + '</td>' +
        '<td class="chains">' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + ageText(r.age_days) + '</td>' +
        '<td class="num implied">' + money(r.implied_value_usd) +
        '<span class="range">' + money(r.implied_low_usd) + ' – ' + money(r.implied_high_usd) + '</span>' +
        '<span class="conf conf-' + r.confidence + '" title="' + r.confidence + ' confidence — ' + r.comp_peers + ' peers, ' + esc(r.multiple_group) + '; in the backtest, rows with this grade landed inside their printed range ' + DATA.backtest.grades[r.confidence].hit_rate_pct + '% of the time">● ' + r.confidence + '</span></td></tr>';
    });
    return html + '</tbody>';
  }

  function liveHtml() {
    var html = '<thead><tr><th>Protocol</th><th>Category</th><th class="num">TVL</th><th class="num">Market cap (real)</th><th class="num">7 days</th><th class="num">Market pays</th></tr></thead><tbody>';
    DATA.live.forEach(function (r) {
      html += '<tr><td class="name-cell">' + esc(r.name) + '<span class="slug">' + esc(r.symbol || r.slug) + '</span></td>' +
        '<td class="cat">' + esc(r.category || 'Uncategorized') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num implied">' + money(r.mcap_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + mult(r.multiple) + ' TVL</td></tr>';
    });
    return html + '</tbody>';
  }

  function render() {
    var table = el('board');
    var detail = el('detail');
    if (state.detail) {
      detail.hidden = false;
      el('board-panel').style.display = 'none';
      renderDetail(state.detail);
      return;
    }
    detail.hidden = true;
    el('board-panel').style.display = '';
    if (state.seg === 'live') {
      el('board-title').textContent = 'Live comparables — protocols whose token already trades';
      el('board-count').textContent = DATA.live_size + ' protocols · the evidence the model is built from';
      table.innerHTML = liveHtml();
      return;
    }
    var rows = visibleRows();
    el('board-title').textContent = state.seg === 'watchlist' ? 'The watchlist — every protocol over the $50M floor' :
      state.seg === 'early' ? 'Early finds — pre-token protocols below the watchlist floor' : 'The board — every pre-token protocol, ranked';
    el('board-count').textContent = rows.length + ' of ' + DATA.board_size + ' rows';
    table.innerHTML = boardHtml(rows);
    var trs = table.querySelectorAll('tbody tr[data-slug]');
    Array.prototype.forEach.call(trs, function (tr) {
      function open() { location.hash = '#/detail/' + tr.getAttribute('data-slug'); }
      tr.addEventListener('click', open);
      tr.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') open(); });
    });
  }

  /* ---------- detail view ---------- */
  function peerGroup(r) {
    var pool = r.multiple_source === 'family' ? DATA.families : DATA.comps;
    for (var i = 0; i < pool.length; i++) if (pool[i].category === r.multiple_group) return pool[i];
    return null;
  }
  function renderDetail(slug) {
    var r = null;
    DATA.rows.forEach(function (row) { if (row.slug === slug) r = row; });
    var node = el('detail');
    if (!r) { node.innerHTML = '<p class="empty">That protocol is not on the board.</p>'; return; }
    var steps = r.farm_steps.map(function (s) { return '<li><div>' + esc(s) + '</div></li>'; }).join('');
    var srcText = r.multiple_source === 'category'
      ? 'the median of ' + r.comp_peers + ' tokenized ' + esc(r.category || '') + ' peers'
      : r.multiple_source === 'family'
        ? 'the median of ' + r.comp_peers + ' tokenized peers in its family, ' + esc(r.multiple_group) + ' — its own category has too few tokenized peers to read'
        : 'the market-wide median of ' + r.comp_peers + ' tokenized protocols — neither its category nor a family has three tokenized peers to read';
    var group = peerGroup(r);
    var peersHtml = '';
    if (group) {
      var shown = group.peer_list.slice(0, 10).map(function (p) {
        return '<li>' + esc(p.name) + (p.symbol ? ' (' + esc(p.symbol) + ')' : '') + ' — the market pays ' + mult(p.multiple) + ' of TVL</li>';
      }).join('');
      peersHtml = '<h3 style="margin-top:20px">The peers behind the multiple</h3><ul class="peerlist">' + shown + '</ul>' +
        (group.peer_list.length > 10 ? '<p class="fineprint">The ' + (group.peer_list.length - 10) + ' smaller peers are in the dataset; the median and quartiles are computed over all ' + group.peers + '.</p>' : '');
    }
    // The range bar: low and high placed on a log scale between half the low and twice the high.
    var lo = Math.log(r.implied_low_usd * 0.5);
    var hi = Math.log(r.implied_high_usd * 2);
    var pos = function (v) { return Math.max(0, Math.min(100, (Math.log(v) - lo) / (hi - lo) * 100)); };
    var barHtml = '<div class="rangebar" role="img" aria-label="Value range ' + money(r.implied_low_usd) + ' to ' + money(r.implied_high_usd) + '">' +
      '<div class="rb-track"></div><div class="rb-span" style="left:' + pos(r.implied_low_usd) + '%;width:' + Math.max(1, pos(r.implied_high_usd) - pos(r.implied_low_usd)) + '%"></div>' +
      '<div class="rb-point" style="left:' + pos(r.implied_value_usd) + '%"></div>' +
      '<span class="rb-lo" style="left:' + pos(r.implied_low_usd) + '%">' + money(r.implied_low_usd) + '</span>' +
      '<span class="rb-hi" style="left:' + pos(r.implied_high_usd) + '%">' + money(r.implied_high_usd) + '</span></div>';
    node.innerHTML =
      '<div class="detail-head"><h2>' + esc(r.name) + (r.watchlist ? '<span class="watch">◆ watchlist</span>' : '') + '</h2>' +
      '<button type="button" class="back" id="back-btn">← Back to the board</button></div>' +
      '<p class="thesis">' + esc(r.thesis) + '</p>' +
      '<div class="detail-grid"><div>' +
      '<h3>The record</h3><dl>' +
      '<dt>Model rank</dt><dd>#' + r.rank + ' of ' + DATA.board_size + '</dd>' +
      '<dt>Category</dt><dd>' + esc(r.category || 'Uncategorized') + '</dd>' +
      '<dt>Chains</dt><dd>' + esc(r.chains.join(', ') || '—') + '</dd>' +
      '<dt>TVL</dt><dd>' + moneyFull(r.tvl_usd) + '</dd>' +
      '<dt>TVL change, 7 days</dt><dd>' + (r.change_7d == null ? 'not reported' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(2) + '%') + '</dd>' +
      '<dt>Tracked since</dt><dd>' + esc(r.listed_at || 'unknown') + ' (' + ageText(r.age_days) + ')</dd>' +
      '<dt>Token today</dt><dd>none recorded — pre-token</dd>' +
      '<dt>If it traded today</dt><dd>rank #' + r.live_rank + ' of ' + DATA.live_total + ' by market cap</dd>' +
      '</dl></div><div>' +
      '<h3>How the model prices it</h3><div class="arith">' +
      'Leg 1 · comparables: TVL ' + moneyFull(r.tvl_usd) + ' × peer multiple ' + mult(r.category_multiple) + '<br>' +
      '&nbsp;&nbsp;(' + srcText + ')<br>' +
      '&nbsp;&nbsp;× momentum ' + r.momentum_factor.toFixed(2) + '× · longevity ' + r.longevity_factor.toFixed(2) + '× = ' + moneyFull(r.comps_value_usd) + '<br>' +
      'Leg 2 · size curve: the market\u2019s fit on TVL alone, same factors = ' + moneyFull(r.regression_value_usd) + '<br>' +
      '<span class="res">Blend, ' + Math.round(r.blend_weight * 100) + '% leg 1 / ' + Math.round((1 - r.blend_weight) * 100) + '% leg 2 = implied value ' + moneyFull(r.implied_value_usd) + '</span></div>' +
      '<p class="conf-line">Confidence: <span class="conf conf-' + r.confidence + '">● ' + r.confidence + '</span> — from ' + r.comp_peers + ' peers and the width of their middle half. In the backtest, rows with this grade landed inside their printed range ' + DATA.backtest.grades[r.confidence].hit_rate_pct + '% of the time (' + DATA.backtest.grades[r.confidence].n + ' live tokens priced as if pre-token).</p>' +
      '<h4 class="range-head">The range the evidence supports</h4>' + barHtml +
      '<p class="fineprint">The range spans the peers\u2019 middle half, the size curve\u2019s estimate, and this grade\u2019s calibrated band from the backtest — the middle half of what rows with this grade actually did. If ' + esc(r.name) + ' issued a token the market priced like those peers, this is the band the model would expect. It says nothing about whether or when a token comes.</p>' +
      '<p class="risk-note">' + esc(r.risk_note) + '</p>' +
      '<p class="fineprint">At a typical launch\u2019s float — about ' + Math.round(DATA.initial_float * 100) + '% of supply trading on day one, the rest locked behind team and investor vesting cliffs — roughly ' + moneyFull(r.float_value_usd) + ' of this value would change hands at first. The implied value prices the whole token, fully diluted; the float is what a farmer would actually meet on the market, and the cliffs ahead of it are the overhang every new token carries.</p>' +
      '</div></div>' + peersHtml +
      '<h3 style="margin-top:20px">The farm plan — ' + r.farm_steps.length + ' steps</h3>' +
      '<ol class="steps">' + steps + '</ol>';
    el('back-btn').addEventListener('click', function () { location.hash = '#/board'; });
    window.scrollTo(0, 0);
  }

  /* ---------- controls + routing ---------- */
  el('q').addEventListener('input', function () { state.q = this.value; if (state.seg === 'live') setSeg('all'); render(); });
  el('f-category').addEventListener('change', function () { state.category = this.value; if (state.seg === 'live') setSeg('all'); render(); });
  el('f-chain').addEventListener('change', function () { state.chain = this.value; if (state.seg === 'live') setSeg('all'); render(); });
  el('f-sort').addEventListener('change', function () { state.sort = this.value; render(); });
  function setSeg(seg) {
    state.seg = seg;
    Array.prototype.forEach.call(document.querySelectorAll('.segments button'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-seg') === seg);
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('.segments button'), function (b) {
    b.addEventListener('click', function () { setSeg(b.getAttribute('data-seg')); state.detail = null; render(); });
  });

  function route() {
    var h = location.hash || '#/board';
    var detailMatch = h.match(/^#\/detail\/(.+)$/);
    var filterMatch = h.match(/^#\/filter\/(.+)$/);
    if (detailMatch) {
      state.detail = decodeURIComponent(detailMatch[1]);
    } else {
      state.detail = null;
      if (filterMatch) {
        var cat = decodeURIComponent(filterMatch[1]);
        state.category = cat;
        el('f-category').value = cat;
        setSeg('all');
      }
    }
    render();
  }
  window.addEventListener('hashchange', route);
  route();
})();
