const TreeViz = (() => {
  // ── State ─────────────────────────────────────────────────────────
  let treeId, members = [], myRole = 'viewer', onMemberClick;
  let tfm = { x: 40, y: 40, s: 1 };        // pan x/y + scale
  let collapsedNodes = new Set();
  let spouseMap = {}, allChildrenOf = {};
  let viewFilter = 'all', focalId = null;
  let nodePositions = {};
  let highlight = null;                      // search-highlighted member id
  let toolbarRendered = false;

  // ── Constants ──────────────────────────────────────────────────────
  const NW = 170, NH = 80, HG = 52, VG = 114;  // node W/H, H-gap, V-gap
  const CR = 12;                                 // collapse circle radius

  // ── Public: init / update ─────────────────────────────────────────
  function init(tid, mems, role, clickCb) {
    treeId = tid; members = mems; myRole = role; onMemberClick = clickCb;
    collapsedNodes = new Set(); highlight = null; toolbarRendered = false;
    focalId = mems.length ? mems[mems.length - 1].id : null;
    tfm = { x: 40, y: 40, s: 1 };
    _buildMaps(); _buildLayout(); _renderAll();
  }

  function update(mems) {
    // Preserve current pan/zoom when members change
    members = mems;
    _buildMaps(); _buildLayout(); _renderContent();
  }

  // ── Internals: maps & layout ───────────────────────────────────────
  function _buildMaps() {
    spouseMap = {}; allChildrenOf = {};
    for (const m of members) {
      if (m.spouse_id) { spouseMap[m.id] = m.spouse_id; spouseMap[m.spouse_id] = m.id; }
      for (const pid of [m.paternal_parent_id, m.maternal_parent_id].filter(Boolean)) {
        if (!allChildrenOf[pid]) allChildrenOf[pid] = [];
        if (!allChildrenOf[pid].includes(m.id)) allChildrenOf[pid].push(m.id);
      }
    }
  }

  function _descendants(id) {
    const result = new Set();
    function walk(nid) {
      const sid = spouseMap[nid];
      const kids = [...(allChildrenOf[nid] || []), ...(sid ? allChildrenOf[sid] || [] : [])];
      for (const k of kids) { if (!result.has(k)) { result.add(k); walk(k); } }
    }
    walk(id); return result;
  }

  function _visibleMembers() {
    let vis = viewFilter === 'all' ? [...members] : _lineageMembers();
    if (!collapsedNodes.size) return vis;
    const hidden = new Set();
    for (const cid of collapsedNodes) for (const d of _descendants(cid)) hidden.add(d);
    return vis.filter(m => !hidden.has(m.id));
  }

  function _lineageMembers() {
    const vis = new Set();
    const start = focalId || (members.length ? members[members.length - 1].id : null);
    function walk(id, depth) {
      if (!id || vis.has(id) || depth > 100) return;
      const m = members.find(x => x.id === id); if (!m) return;
      vis.add(id);
      const sid = spouseMap[id]; if (sid) vis.add(sid);
      walk(viewFilter === 'paternal' ? m.paternal_parent_id : m.maternal_parent_id, depth + 1);
    }
    walk(start, 0);
    return members.filter(m => vis.has(m.id));
  }

  function _buildLayout() {
    nodePositions = {};
    const vis = _visibleMembers();
    const placed = new Set(), cof = {};
    for (const m of vis)
      for (const pid of [m.paternal_parent_id, m.maternal_parent_id].filter(Boolean)) {
        if (!cof[pid]) cof[pid] = [];
        if (!cof[pid].includes(m.id)) cof[pid].push(m.id);
      }

    const gc = id => (cof[id] || []).map(cid => vis.find(m => m.id === cid)).filter(Boolean);
    const hasP = new Set(vis.filter(m => m.paternal_parent_id || m.maternal_parent_id).map(m => m.id));
    const roots = vis.filter(m => {
      if (hasP.has(m.id)) return false;
      const sid = spouseMap[m.id]; if (!sid) return true;
      if (hasP.has(sid)) return false; return m.id < sid;
    });
    if (!roots.length && vis.length) roots.push(vis[0]);

    function place(m, depth, col) {
      if (placed.has(m.id)) return col;
      placed.add(m.id);
      const cids = new Set();
      gc(m.id).forEach(c => cids.add(c.id));
      const sid = spouseMap[m.id]; if (sid) gc(sid).forEach(c => cids.add(c.id));
      const kids = [...cids].map(id => vis.find(m => m.id === id)).filter(Boolean);
      let cols = [], c = col;
      for (const kid of kids) {
        if (placed.has(kid.id)) continue;
        c = place(kid, depth + 1, c);
        cols.push(nodePositions[kid.id] ? nodePositions[kid.id].cx : c); c++;
      }
      const x = cols.length ? (Math.min(...cols) + Math.max(...cols)) / 2 : col;
      nodePositions[m.id] = { cx: x, cy: depth };
      if (sid && !placed.has(sid)) {
        const sp = vis.find(m => m.id === sid);
        if (sp) { placed.add(sp.id); nodePositions[sp.id] = { cx: x + 1, cy: depth }; c = Math.max(c, x + 2); }
      }
      return cols.length ? c : col + 1;
    }

    let sc = 0;
    for (const r of roots) { if (!placed.has(r.id)) sc = place(r, 0, sc) + 1; }
    let ex = 0;
    for (const m of vis) { if (!nodePositions[m.id]) { nodePositions[m.id] = { cx: sc + ex, cy: 0 }; ex++; } }
  }

  function _px(cx, cy) { return { x: cx * (NW + HG) + 40, y: cy * (NH + VG) + 40 }; }

  function _wrap(name) {
    if (name.length <= 14) return [name, ''];
    const words = name.split(' ');
    if (words.length === 1) return [name.slice(0, 13) + '…', ''];
    let l1 = words[0], i = 1;
    while (i < words.length && (l1 + ' ' + words[i]).length <= 14) l1 += ' ' + words[i++];
    let l2 = words.slice(i).join(' ');
    if (l2.length > 15) l2 = l2.slice(0, 14) + '…';
    return [l1, l2];
  }

  function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Rendering ──────────────────────────────────────────────────────
  function _renderAll() {
    const container = document.getElementById('tree-canvas');
    if (!container) return;
    const focalOpts = members.map(m =>
      `<option value="${m.id}" ${m.id === focalId ? 'selected' : ''}>${_esc(m.name)}</option>`).join('');

    container.innerHTML = `
      <div class="tree-toolbar">
        <div class="tree-filter-group">
          <span class="tree-toolbar-label">View:</span>
          <button class="tree-filter-btn ${viewFilter === 'all' ? 'active' : ''}" onclick="TreeViz.setFilter('all',this)">All</button>
          <button class="tree-filter-btn ${viewFilter === 'paternal' ? 'active' : ''}" onclick="TreeViz.setFilter('paternal',this)">👨 Paternal</button>
          <button class="tree-filter-btn ${viewFilter === 'maternal' ? 'active' : ''}" onclick="TreeViz.setFilter('maternal',this)">👩 Maternal</button>
          <span class="tree-toolbar-label" style="margin-left:.5rem">From:</span>
          <select class="tree-select" id="tree-focal-sel" onchange="TreeViz.setFocal(this.value)">${focalOpts}</select>
        </div>
        <div class="tree-search-wrap">
          <span class="tree-search-icon">🔍</span>
          <input class="tree-search-input" id="tree-search-inp" type="search" placeholder="Search member…" oninput="TreeViz.search(this.value)">
        </div>
        <div class="tree-controls-row">
          <button class="tree-btn" onclick="TreeViz.zoom(0.15)" title="Zoom in">+</button>
          <button class="tree-btn" onclick="TreeViz.zoom(-0.15)" title="Zoom out">−</button>
          <button class="tree-btn" onclick="TreeViz.fitView()" title="Fit to screen">⊙</button>
          <button class="tree-btn tree-btn-dl" onclick="TreeViz.downloadPNG()">↓ PNG</button>
        </div>
      </div>
      <div class="tree-stage" id="tree-stage">
        <svg id="tree-svg" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
          <defs>
            <filter id="tshadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#00000018"/>
            </filter>
          </defs>
          <g id="tree-g"></g>
        </svg>
      </div>`;

    toolbarRendered = true;
    _setupInteraction();
    _renderContent();
    requestAnimationFrame(() => fitView());
  }

  function _renderContent() {
    const g = document.getElementById('tree-g');
    if (!g) { _renderAll(); return; }

    const vis = _visibleMembers();

    if (!vis.length) {
      g.innerHTML = `<foreignObject x="0" y="0" width="600" height="300">
        <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:260px;gap:1rem;color:#64748b;font-family:system-ui,sans-serif">
          <div style="font-size:3.5rem">🌳</div>
          <p>No members to display.</p>
          ${myRole !== 'viewer' ? '<button onclick="App.showAddMember()" style="padding:.5rem 1.25rem;background:#1a2744;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem">Add First Member</button>' : ''}
        </div></foreignObject>`;
      _applyTfm();
      return;
    }

    // ── Edges ──────────────────────────────────────────────────────
    let edges = '';
    const drawnSpouse = new Set();

    // Spouse lines (dashed pink)
    for (const m of vis) {
      const sid = spouseMap[m.id];
      if (!sid || !nodePositions[m.id] || !nodePositions[sid]) continue;
      const key = [m.id, sid].sort().join('|');
      if (drawnSpouse.has(key)) continue;
      drawnSpouse.add(key);
      const p1 = _px(nodePositions[m.id].cx, nodePositions[m.id].cy);
      const p2 = _px(nodePositions[sid].cx, nodePositions[sid].cy);
      // Connect right edge of left node to left edge of right node
      const [left, right] = p1.x < p2.x ? [p1, p2] : [p2, p1];
      edges += `<line x1="${left.x + NW}" y1="${left.y + NH / 2}" x2="${right.x}" y2="${right.y + NH / 2}" stroke="#f472b6" stroke-width="2" stroke-dasharray="5,3" opacity="0.7"/>`;
    }

    // Parent-child edges (orthogonal elbow routing)
    for (const m of vis) {
      if (!nodePositions[m.id]) continue;
      const cp = _px(nodePositions[m.id].cx, nodePositions[m.id].cy);
      const childCX = cp.x + NW / 2, childTY = cp.y;
      const midY = childTY - VG / 2;

      const pid = m.paternal_parent_id, mid_ = m.maternal_parent_id;
      const pp = pid && nodePositions[pid] ? _px(nodePositions[pid].cx, nodePositions[pid].cy) : null;
      const mp = mid_ && nodePositions[mid_] ? _px(nodePositions[mid_].cx, nodePositions[mid_].cy) : null;

      if (!pp && !mp) continue;

      if (pp && mp && pid !== mid_) {
        // Both parents visible
        const fX = pp.x + NW / 2, fBY = pp.y + NH;
        const mX = mp.x + NW / 2, mBY = mp.y + NH;
        const jX = (fX + mX) / 2;
        // Father → midY → junction
        edges += `<path d="M${fX},${fBY} V${midY} H${jX}" stroke="#6366f1" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>`;
        // Mother → midY → junction
        edges += `<path d="M${mX},${mBY} V${midY} H${jX}" stroke="#a78bfa" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>`;
        // Junction → child
        edges += `<path d="M${jX},${midY} V${childTY}" stroke="#475569" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.45"/>`;
        edges += `<circle cx="${jX}" cy="${midY}" r="3" fill="#6366f1" opacity="0.45"/>`;
      } else {
        const src = pp || mp;
        const stroke = pp ? '#c9a84c' : '#a78bfa';
        const sX = src.x + NW / 2, sY = src.y + NH;
        // Elbow: down from parent → across → up to child
        edges += `<path d="M${sX},${sY} V${midY} H${childCX} V${childTY}" stroke="${stroke}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.65"/>`;
      }
    }

    // ── Nodes ──────────────────────────────────────────────────────
    let nodes = '';
    for (const m of vis) {
      const pos = nodePositions[m.id];
      if (!pos) continue;
      const { x, y } = _px(pos.cx, pos.cy);
      const gc = m.gender === 'male' ? '#3b82f6' : m.gender === 'female' ? '#ec4899' : '#8b5cf6';
      const isHL = m.id === highlight;
      const [l1, l2] = _wrap(m.name);
      const lifespan = [m.birth_year, m.death_year].filter(Boolean).join(' – ');
      const isCollapsed = collapsedNodes.has(m.id);
      const desc = _descendants(m.id);
      const hasKids = desc.size > 0;

      // Avatar
      const initials = _esc(m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2));
      const photoEl = m.photo
        ? `<image href="${m.photo}" x="${x + 8}" y="${y + 8}" width="42" height="42" clip-path="url(#cp${m.id.replace(/-/g, '')})" preserveAspectRatio="xMidYMid slice"/>
           <clipPath id="cp${m.id.replace(/-/g, '')}"><circle cx="${x + 29}" cy="${y + 29}" r="21"/></clipPath>`
        : `<circle cx="${x + 29}" cy="${y + 29}" r="21" fill="${gc}" opacity="0.15"/>
           <text x="${x + 29}" y="${y + 34}" text-anchor="middle" font-size="13" font-weight="700" fill="${gc}">${initials}</text>`;

      // Name text (1 or 2 lines)
      const nameEl = l2
        ? `<text x="${x + 62}" y="${y + 22}" font-size="11" font-weight="700" fill="#1e293b" dominant-baseline="middle">${_esc(l1)}</text>
           <text x="${x + 62}" y="${y + 37}" font-size="10.5" font-weight="600" fill="#334155" dominant-baseline="middle">${_esc(l2)}</text>`
        : `<text x="${x + 62}" y="${y + 29}" font-size="12" font-weight="700" fill="#1e293b" dominant-baseline="middle">${_esc(l1)}</text>`;

      const lifespanEl = lifespan
        ? `<text x="${x + 62}" y="${y + 58}" font-size="9" fill="#64748b">${_esc(lifespan)}</text>` : '';
      const deadEl = m.death_year
        ? `<text x="${x + NW - 7}" y="${y + 14}" text-anchor="end" font-size="10" fill="#94a3b8">✝</text>` : '';

      // Search highlight ring
      const hlRing = isHL
        ? `<rect x="${x - 5}" y="${y - 5}" width="${NW + 10}" height="${NH + 10}" rx="15" fill="none" stroke="#f59e0b" stroke-width="3" stroke-dasharray="6,3"/>` : '';

      // Collapse button (circle below node center)
      let collapseEl = '';
      if (isCollapsed) {
        const by = y + NH + CR + 3;
        const label = desc.size > 99 ? '99+' : `+${desc.size}`;
        collapseEl = `<g class="col-btn" onclick="event.stopPropagation();TreeViz.toggleCollapse('${m.id}')" style="cursor:pointer">
          <circle cx="${x + NW / 2}" cy="${by}" r="${CR}" fill="${gc}"/>
          <text x="${x + NW / 2}" y="${by + 4}" text-anchor="middle" font-size="9.5" font-weight="700" fill="white">${label}</text>
        </g>`;
      } else if (hasKids) {
        const by = y + NH + CR + 3;
        collapseEl = `<g class="col-btn" onclick="event.stopPropagation();TreeViz.toggleCollapse('${m.id}')" style="cursor:pointer">
          <circle cx="${x + NW / 2}" cy="${by}" r="${CR}" fill="white" stroke="${gc}" stroke-width="1.5"/>
          <text x="${x + NW / 2}" y="${by + 5}" text-anchor="middle" font-size="16" font-weight="400" fill="${gc}">−</text>
        </g>`;
      }

      nodes += `<g class="tree-node" data-id="${m.id}">
        ${hlRing}
        <rect x="${x}" y="${y}" width="${NW}" height="${NH}" rx="10" fill="white"
          stroke="${gc}" stroke-width="${isHL ? 3 : 2}" filter="url(#tshadow)"
          onclick="TreeViz.handleClick('${m.id}')" style="cursor:pointer"/>
        ${photoEl}${nameEl}${lifespanEl}${deadEl}${collapseEl}
      </g>`;
    }

    // Update focal selector if it exists
    const fsel = document.getElementById('tree-focal-sel');
    if (fsel) {
      fsel.innerHTML = members.map(m =>
        `<option value="${m.id}" ${m.id === focalId ? 'selected' : ''}>${_esc(m.name)}</option>`).join('');
    }

    g.innerHTML = edges + nodes;
    _applyTfm();
  }

  function _applyTfm() {
    const g = document.getElementById('tree-g');
    if (g) g.setAttribute('transform', `translate(${tfm.x},${tfm.y}) scale(${tfm.s})`);
  }

  // ── Interaction: pan, wheel zoom ───────────────────────────────────
  function _setupInteraction() {
    const stage = document.getElementById('tree-stage');
    if (!stage) return;

    // Mouse pan
    let drag = false, sx = 0, sy = 0, ox = 0, oy = 0;
    stage.addEventListener('mousedown', e => {
      if (e.target.closest('.tree-node') || e.target.closest('.col-btn')) return;
      drag = true; sx = e.clientX; sy = e.clientY; ox = tfm.x; oy = tfm.y;
      stage.style.cursor = 'grabbing'; e.preventDefault();
    });
    window.addEventListener('mousemove', e => {
      if (!drag) return;
      tfm.x = ox + e.clientX - sx; tfm.y = oy + e.clientY - sy; _applyTfm();
    });
    window.addEventListener('mouseup', () => { drag = false; const s = document.getElementById('tree-stage'); if (s) s.style.cursor = ''; });

    // Touch pan
    let touch = false, tsx = 0, tsy = 0, tox = 0, toy = 0;
    stage.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      touch = true; tsx = e.touches[0].clientX; tsy = e.touches[0].clientY; tox = tfm.x; toy = tfm.y;
    }, { passive: true });
    stage.addEventListener('touchmove', e => {
      if (!touch || e.touches.length !== 1) return;
      tfm.x = tox + e.touches[0].clientX - tsx; tfm.y = toy + e.touches[0].clientY - tsy; _applyTfm();
    }, { passive: true });
    stage.addEventListener('touchend', () => { touch = false; });

    // Wheel zoom (zoom towards cursor position)
    stage.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      const rect = stage.getBoundingClientRect();
      _zoomAt(delta, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });
  }

  function _zoomAt(delta, cx, cy) {
    const oldS = tfm.s;
    tfm.s = Math.min(3, Math.max(0.12, tfm.s + delta));
    const f = tfm.s / oldS;
    tfm.x = cx - f * (cx - tfm.x);
    tfm.y = cy - f * (cy - tfm.y);
    _applyTfm();
  }

  // ── Public controls ────────────────────────────────────────────────
  function zoom(delta) {
    const stage = document.getElementById('tree-stage');
    if (!stage) return;
    _zoomAt(delta, stage.clientWidth / 2, stage.clientHeight / 2);
  }

  function fitView() {
    const stage = document.getElementById('tree-stage');
    if (!stage) return;
    const allPos = Object.values(nodePositions);
    if (!allPos.length) return;
    const maxCx = Math.max(...allPos.map(p => p.cx));
    const maxCy = Math.max(...allPos.map(p => p.cy));
    const contentW = (maxCx + 1) * (NW + HG) + NW + 80;
    const contentH = (maxCy + 1) * (NH + VG) + NH + 80;
    const sw = stage.clientWidth, sh = stage.clientHeight;
    tfm.s = Math.min(sw / contentW, sh / contentH, 1.2);
    tfm.x = (sw - contentW * tfm.s) / 2 + 20;
    tfm.y = (sh - contentH * tfm.s) / 2 + 20;
    _applyTfm();
  }

  function resetView() { fitView(); }

  function toggleCollapse(id) {
    if (collapsedNodes.has(id)) collapsedNodes.delete(id);
    else collapsedNodes.add(id);
    _buildLayout(); _renderContent();
  }

  function setFilter(f, btn) {
    viewFilter = f;
    document.querySelectorAll('.tree-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    _buildLayout(); _renderContent();
    requestAnimationFrame(() => fitView());
  }

  function setFocal(id) {
    focalId = id;
    if (viewFilter !== 'all') { _buildLayout(); _renderContent(); requestAnimationFrame(() => fitView()); }
    else _renderContent();
  }

  function search(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) { highlight = null; _renderContent(); return; }
    const match = _visibleMembers().find(m => m.name.toLowerCase().includes(q));
    highlight = match ? match.id : null;
    _renderContent();
    if (match && nodePositions[match.id]) {
      const stage = document.getElementById('tree-stage');
      if (!stage) return;
      const { x, y } = _px(nodePositions[match.id].cx, nodePositions[match.id].cy);
      tfm.x = stage.clientWidth / 2 - (x + NW / 2) * tfm.s;
      tfm.y = stage.clientHeight / 2 - (y + NH / 2) * tfm.s;
      _applyTfm();
    }
  }

  function handleClick(id) { if (onMemberClick) onMemberClick(id); }

  function downloadPNG() {
    const svg = document.getElementById('tree-svg');
    if (!svg) return;
    const allPos = Object.values(nodePositions);
    if (!allPos.length) return;
    const maxCx = Math.max(...allPos.map(p => p.cx));
    const maxCy = Math.max(...allPos.map(p => p.cy));
    const W = (maxCx + 2) * (NW + HG) + 80, H = (maxCy + 1) * (NH + VG) + 80;

    const clone = svg.cloneNode(true);
    clone.querySelectorAll('image').forEach(i => i.remove());
    clone.setAttribute('width', W); clone.setAttribute('height', H);
    const gClone = clone.querySelector('#tree-g');
    if (gClone) gClone.setAttribute('transform', 'translate(0,0) scale(1)');

    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f8f5ee'; ctx.fillRect(0, 0, W, H); ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const a = document.createElement('a'); a.download = 'family-tree.png'; a.href = c.toDataURL('image/png'); a.click();
    };
    img.onerror = () => { URL.revokeObjectURL(url); alert('PNG export failed.'); };
    img.src = url;
  }

  return { init, update, zoom, fitView, resetView, handleClick, toggleCollapse, setFilter, setFocal, search, downloadPNG };
})();
