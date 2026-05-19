const TreeViz = (() => {
  // ── State ─────────────────────────────────────────────────────────
  let treeId, members = [], myRole = 'viewer', onMemberClick;
  let tfm = { x: 40, y: 40, s: 1 };
  let collapsedNodes = new Set();
  let spouseMap = {};
  let viewFilter = 'all', focalId = null;
  let nodePositions = {};   // id → { cx, cy }
  let highlight = null;

  // ── Constants ──────────────────────────────────────────────────────
  const NW = 170, NH = 80, HG = 56, VG = 110;
  const CR = 12, R = 8;   // collapse-circle radius, edge corner radius

  // ── Public API ─────────────────────────────────────────────────────
  function init(tid, mems, role, clickCb) {
    treeId = tid; members = mems; myRole = role; onMemberClick = clickCb;
    collapsedNodes = new Set(); highlight = null;
    focalId = mems.length ? mems[mems.length - 1].id : null;
    tfm = { x: 40, y: 40, s: 1 };
    _buildMaps(); _buildLayout(); _renderAll();
  }

  function update(mems) {
    members = mems;
    _buildMaps(); _buildLayout(); _renderContent();
  }

  // ── Maps ───────────────────────────────────────────────────────────
  function _buildMaps() {
    spouseMap = {};
    for (const m of members) {
      if (m.spouse_id) {
        spouseMap[m.id] = m.spouse_id;
        spouseMap[m.spouse_id] = m.id;
      }
    }
  }

  // All descendants (from full members list, not filtered)
  function _descendants(id) {
    const result = new Set();
    function walk(nid) {
      const sid = spouseMap[nid];
      for (const m of members) {
        if (m.paternal_parent_id === nid || m.maternal_parent_id === nid ||
            (sid && (m.paternal_parent_id === sid || m.maternal_parent_id === sid))) {
          if (!result.has(m.id)) { result.add(m.id); walk(m.id); }
        }
      }
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
    const start = focalId && members.find(x => x.id === focalId)
      ? focalId
      : (members.length ? members[members.length - 1].id : null);
    if (!start) return [];

    // 1. Walk up the chosen side to the topmost ancestor.
    let topId = start, cur = start, guard = 0;
    const upSeen = new Set();
    while (cur && !upSeen.has(cur) && guard++ < 300) {
      upSeen.add(cur);
      const m = members.find(x => x.id === cur); if (!m) break;
      const pid = viewFilter === 'paternal' ? m.paternal_parent_id : m.maternal_parent_id;
      if (pid && members.find(x => x.id === pid)) { topId = pid; cur = pid; }
      else break;
    }

    // 2. From the top ancestor, include the entire descendant subtree
    //    plus spouses, so every visible node keeps its connector.
    const vis = new Set();
    function descend(id, depth) {
      if (!id || vis.has(id) || depth > 300) return;
      vis.add(id);
      const sid = spouseMap[id]; if (sid) vis.add(sid);
      for (const m of members) {
        if (m.paternal_parent_id === id || m.maternal_parent_id === id ||
            (sid && (m.paternal_parent_id === sid || m.maternal_parent_id === sid))) {
          descend(m.id, depth + 1);
        }
      }
    }
    descend(topId, 0);
    return members.filter(m => vis.has(m.id));
  }

  // ── Layout ─────────────────────────────────────────────────────────
  function _buildLayout() {
    nodePositions = {};
    const vis = _visibleMembers();
    if (!vis.length) return;

    const visIds = new Set(vis.map(m => m.id));

    // Children map: parent_id → [child_ids] — only for VISIBLE parents
    const cof = {};
    for (const m of vis) {
      for (const pid of [m.paternal_parent_id, m.maternal_parent_id].filter(Boolean)) {
        if (!visIds.has(pid)) continue;
        if (!cof[pid]) cof[pid] = [];
        if (!cof[pid].includes(m.id)) cof[pid].push(m.id);
      }
    }

    // Unique children of id (merging with visible spouse's children)
    const getKids = id => {
      const sid = spouseMap[id] && visIds.has(spouseMap[id]) ? spouseMap[id] : null;
      const set = new Set([...(cof[id] || []), ...(sid ? cof[sid] || [] : [])]);
      return [...set];
    };

    // Members that have at least one VISIBLE parent
    const hasVisParent = new Set(vis.filter(m =>
      (m.paternal_parent_id && visIds.has(m.paternal_parent_id)) ||
      (m.maternal_parent_id && visIds.has(m.maternal_parent_id))
    ).map(m => m.id));

    // Root detection: no visible parent; for couples only take the smaller id
    const roots = vis.filter(m => {
      if (hasVisParent.has(m.id)) return false;
      const sid = spouseMap[m.id];
      const sVis = sid && visIds.has(sid);
      if (sVis && hasVisParent.has(sid)) return false;
      if (sVis) return m.id < sid;  // couple: only one root per pair
      return true;
    });
    if (!roots.length && vis.length) roots.push(vis[0]);

    const placed = new Set();

    // Recursive width-packing: each subtree occupies a disjoint column
    // range, so siblings never overlap. Returns the next free column.
    function placeSubtree(id, depth, leftCol) {
      placed.add(id);
      const sid = spouseMap[id] && visIds.has(spouseMap[id]) ? spouseMap[id] : null;
      if (sid) placed.add(sid);
      const coupleW = sid ? 2 : 1;

      const kids = getKids(id).filter(k => !placed.has(k));

      if (kids.length === 0) {
        // Leaf: occupy its own column(s) at leftCol.
        nodePositions[id] = { cx: leftCol, cy: depth };
        if (sid) nodePositions[sid] = { cx: leftCol + 1, cy: depth };
        return leftCol + coupleW;
      }

      // Lay children out side by side starting at leftCol.
      let c = leftCol;
      const kidCenters = [];
      for (const kid of kids) {
        if (placed.has(kid)) continue;
        const next = placeSubtree(kid, depth + 1, c);
        if (nodePositions[kid]) kidCenters.push(nodePositions[kid].cx);
        c = next;
      }

      const childrenRight = c;
      const center = kidCenters.length
        ? (Math.min(...kidCenters) + Math.max(...kidCenters)) / 2
        : leftCol;

      if (sid) {
        // Clamp so the left spouse never overlaps the previous sibling subtree.
        const leftBound = Math.max(center - 0.5, leftCol);
        const actualCenter = leftBound + 0.5;
        nodePositions[id]  = { cx: actualCenter - 0.5, cy: depth };
        nodePositions[sid] = { cx: actualCenter + 0.5, cy: depth };
        return Math.max(childrenRight, actualCenter + 1);
      } else {
        const actualCx = Math.max(center, leftCol);
        nodePositions[id] = { cx: actualCx, cy: depth };
        return Math.max(childrenRight, actualCx + 1);
      }
    }

    let nextCol = 0;
    for (const r of roots) {
      if (!placed.has(r.id)) {
        nextCol = placeSubtree(r.id, 0, nextCol);
        nextCol = Math.ceil(nextCol) + 1; // gap between separate family trees
      }
    }

    // Fallback for any member that slipped through — infer depth from relatives
    for (const m of vis) {
      if (!nodePositions[m.id]) {
        const sid = spouseMap[m.id];
        let cy = 0;
        if (m.paternal_parent_id && nodePositions[m.paternal_parent_id]) {
          cy = nodePositions[m.paternal_parent_id].cy + 1;
        } else if (m.maternal_parent_id && nodePositions[m.maternal_parent_id]) {
          cy = nodePositions[m.maternal_parent_id].cy + 1;
        } else if (sid && nodePositions[sid]) {
          cy = nodePositions[sid].cy;
        } else {
          for (const child of vis) {
            if ((child.paternal_parent_id === m.id || child.maternal_parent_id === m.id) && nodePositions[child.id]) {
              cy = Math.max(0, nodePositions[child.id].cy - 1);
              break;
            }
          }
        }
        nodePositions[m.id] = { cx: nextCol, cy };
        nextCol++;
      }
    }
  }

  // ── Pixel helpers ──────────────────────────────────────────────────
  function _px(cx, cy) {
    return { x: cx * (NW + HG) + 40, y: cy * (NH + VG) + 40 };
  }

  // Rounded two-elbow path: (x1,y1) → midY → (x2,y2) with bezier corners
  function _elbow(x1, y1, x2, y2) {
    if (Math.abs(x1 - x2) < 0.5) return `M${x1},${y1} V${y2}`;
    const midY = (y1 + y2) / 2;
    const dx = (x2 > x1 ? 1 : -1) * Math.min(R, Math.abs(x2 - x1) / 2);
    const dy = Math.min(R, (midY - y1) / 2, (y2 - midY) / 2);
    return (
      `M${x1},${y1} V${midY - dy} ` +
      `Q${x1},${midY} ${x1 + dx},${midY} ` +
      `H${x2 - dx} ` +
      `Q${x2},${midY} ${x2},${midY + dy} V${y2}`
    );
  }

  // Rounded single-elbow path: (x1,y1) goes down then turns to reach (x2, endY)
  function _halfElbow(x1, y1, x2, endY) {
    if (Math.abs(x1 - x2) < 0.5) return `M${x1},${y1} V${endY}`;
    const dx = (x2 > x1 ? 1 : -1) * Math.min(R, Math.abs(x2 - x1) / 2);
    const dy = Math.min(R, (endY - y1) / 2);
    return (
      `M${x1},${y1} V${endY - dy} ` +
      `Q${x1},${endY} ${x1 + dx},${endY} H${x2}`
    );
  }

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
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Rendering ──────────────────────────────────────────────────────
  function _renderAll() {
    const container = document.getElementById('tree-canvas');
    if (!container) return;
    const focalOpts = members.map(m =>
      `<option value="${m.id}" ${m.id === focalId ? 'selected' : ''}>${_esc(m.name)}</option>`
    ).join('');

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
          <button class="tree-btn" id="tree-fs-btn" onclick="TreeViz.toggleFullscreen()" title="Fullscreen">⛶</button>
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

    _setupInteraction();
    _renderContent();
    requestAnimationFrame(() => fitView());
  }

  function _renderContent() {
    const g = document.getElementById('tree-g');
    if (!g) { _renderAll(); return; }

    const vis = _visibleMembers();
    const visIds = new Set(vis.map(m => m.id));

    if (!vis.length) {
      g.innerHTML = `<foreignObject x="0" y="0" width="600" height="300">
        <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:260px;gap:1rem;color:#64748b;font-family:system-ui,sans-serif">
          <div style="font-size:3.5rem">🌳</div>
          <p>No members to display.</p>
          ${myRole !== 'viewer' ? '<button onclick="App.showAddMember()" style="padding:.5rem 1.25rem;background:#1a2744;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem">Add First Member</button>' : ''}
        </div></foreignObject>`;
      _applyTfm(); return;
    }

    let edges = '', nodes = '';
    const drawnSpouse = new Set();

    // ── Spouse connector lines (dashed pink) ───────────────────────
    for (const m of vis) {
      const sid = spouseMap[m.id];
      if (!sid || !visIds.has(sid) || !nodePositions[m.id] || !nodePositions[sid]) continue;
      const key = [m.id, sid].sort().join('|');
      if (drawnSpouse.has(key)) continue;
      drawnSpouse.add(key);
      const p1 = _px(nodePositions[m.id].cx, nodePositions[m.id].cy);
      const p2 = _px(nodePositions[sid].cx, nodePositions[sid].cy);
      const [left, right] = p1.x < p2.x ? [p1, p2] : [p2, p1];
      edges += `<line x1="${left.x + NW}" y1="${left.y + NH / 2}" x2="${right.x}" y2="${right.y + NH / 2}" stroke="#f472b6" stroke-width="2" stroke-dasharray="5,3" opacity="0.7"/>`;
    }

    // ── Parent→child edges ─────────────────────────────────────────
    for (const m of vis) {
      if (!nodePositions[m.id]) continue;
      const cp    = _px(nodePositions[m.id].cx, nodePositions[m.id].cy);
      const childCX = cp.x + NW / 2;
      const childTY = cp.y;
      const midY   = childTY - VG / 2;

      const pid  = m.paternal_parent_id;
      const mid_ = m.maternal_parent_id;
      const pp = pid  && visIds.has(pid)  && nodePositions[pid]  ? _px(nodePositions[pid].cx,  nodePositions[pid].cy)  : null;
      const mp = mid_ && visIds.has(mid_) && nodePositions[mid_] ? _px(nodePositions[mid_].cx, nodePositions[mid_].cy) : null;

      if (!pp && !mp) continue;

      if (pp && mp && pid !== mid_) {
        // Both parents visible → converge to junction dot, then down to child
        const fX = pp.x + NW / 2, fBY = pp.y + NH;
        const mX = mp.x + NW / 2, mBY = mp.y + NH;
        const jX = (fX + mX) / 2;

        edges += `<path d="${_halfElbow(fX, fBY, jX, midY)}" stroke="#6366f1" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.65"/>`;
        edges += `<path d="${_halfElbow(mX, mBY, jX, midY)}" stroke="#a78bfa" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.65"/>`;
        edges += `<path d="${_elbow(jX, midY, childCX, childTY)}" stroke="#475569" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>`;
        edges += `<circle cx="${jX}" cy="${midY}" r="3" fill="#6366f1" opacity="0.5"/>`;
      } else {
        // Single visible parent
        const src = pp || mp;
        const stroke = pp ? '#c9a84c' : '#a78bfa';
        const sX = src.x + NW / 2, sY = src.y + NH;
        edges += `<path d="${_elbow(sX, sY, childCX, childTY)}" stroke="${stroke}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.65"/>`;
      }
    }

    // ── Nodes ──────────────────────────────────────────────────────
    for (const m of vis) {
      const pos = nodePositions[m.id];
      if (!pos) continue;
      const { x, y } = _px(pos.cx, pos.cy);
      const gc    = m.gender === 'male' ? '#3b82f6' : m.gender === 'female' ? '#ec4899' : '#8b5cf6';
      const isHL  = m.id === highlight;
      const [l1, l2] = _wrap(m.name);
      const lifespan  = [m.birth_year, m.death_year].filter(Boolean).join(' – ');
      const isCollapsed = collapsedNodes.has(m.id);
      const desc   = _descendants(m.id);
      const hasKids = desc.size > 0;

      const initials = _esc(m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2));
      const safeId   = m.id.replace(/-/g, '');

      const photoEl = m.photo
        ? `<image href="${m.photo}" x="${x+8}" y="${y+8}" width="42" height="42" clip-path="url(#cp${safeId})" preserveAspectRatio="xMidYMid slice"/>
           <clipPath id="cp${safeId}"><circle cx="${x+29}" cy="${y+29}" r="21"/></clipPath>`
        : `<circle cx="${x+29}" cy="${y+29}" r="21" fill="${gc}" opacity="0.15"/>
           <text x="${x+29}" y="${y+34}" text-anchor="middle" font-size="13" font-weight="700" fill="${gc}">${initials}</text>`;

      const nameEl = l2
        ? `<text x="${x+62}" y="${y+22}" font-size="11" font-weight="700" fill="#1e293b" dominant-baseline="middle">${_esc(l1)}</text>
           <text x="${x+62}" y="${y+37}" font-size="10.5" font-weight="600" fill="#334155" dominant-baseline="middle">${_esc(l2)}</text>`
        : `<text x="${x+62}" y="${y+29}" font-size="12" font-weight="700" fill="#1e293b" dominant-baseline="middle">${_esc(l1)}</text>`;

      const lifespanEl = lifespan
        ? `<text x="${x+62}" y="${y+58}" font-size="9" fill="#64748b">${_esc(lifespan)}</text>` : '';
      const deadEl = m.death_year
        ? `<text x="${x+NW-7}" y="${y+14}" text-anchor="end" font-size="10" fill="#94a3b8">✝</text>` : '';

      const hlRing = isHL
        ? `<rect x="${x-5}" y="${y-5}" width="${NW+10}" height="${NH+10}" rx="15" fill="none" stroke="#f59e0b" stroke-width="3" stroke-dasharray="6,3"/>` : '';

      let collapseEl = '';
      const by = y + NH + CR + 3;
      if (isCollapsed) {
        const label = desc.size > 99 ? '99+' : `+${desc.size}`;
        collapseEl = `<g class="col-btn" onclick="event.stopPropagation();TreeViz.toggleCollapse('${m.id}')" style="cursor:pointer">
          <circle cx="${x+NW/2}" cy="${by}" r="${CR}" fill="${gc}"/>
          <text x="${x+NW/2}" y="${by+4}" text-anchor="middle" font-size="9.5" font-weight="700" fill="white">${label}</text>
        </g>`;
      } else if (hasKids) {
        collapseEl = `<g class="col-btn" onclick="event.stopPropagation();TreeViz.toggleCollapse('${m.id}')" style="cursor:pointer">
          <circle cx="${x+NW/2}" cy="${by}" r="${CR}" fill="white" stroke="${gc}" stroke-width="1.5"/>
          <text x="${x+NW/2}" y="${by+5}" text-anchor="middle" font-size="16" font-weight="400" fill="${gc}">−</text>
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

    // Keep focal selector current
    const fsel = document.getElementById('tree-focal-sel');
    if (fsel) {
      fsel.innerHTML = members.map(m =>
        `<option value="${m.id}" ${m.id === focalId ? 'selected' : ''}>${_esc(m.name)}</option>`
      ).join('');
    }

    g.innerHTML = edges + nodes;
    _applyTfm();
  }

  function _applyTfm() {
    const g = document.getElementById('tree-g');
    if (g) g.setAttribute('transform', `translate(${tfm.x},${tfm.y}) scale(${tfm.s})`);
  }

  // ── Interaction ────────────────────────────────────────────────────
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
    window.addEventListener('mouseup', () => {
      drag = false;
      const s = document.getElementById('tree-stage'); if (s) s.style.cursor = '';
    });

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

    // Wheel zoom (toward cursor)
    stage.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.12 : -0.12;
      const rect = stage.getBoundingClientRect();
      _zoomAt(delta, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });

    // Fullscreen change
    document.addEventListener('fullscreenchange', () => {
      const btn = document.getElementById('tree-fs-btn');
      if (btn) btn.textContent = document.fullscreenElement ? '✕' : '⛶';
      requestAnimationFrame(() => fitView());
    });
  }

  function _zoomAt(delta, cx, cy) {
    const oldS = tfm.s;
    tfm.s = Math.min(3, Math.max(0.1, tfm.s + delta));
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
    if (!stage || !stage.clientWidth || !stage.clientHeight) return;
    const allPos = Object.values(nodePositions);
    if (!allPos.length) return;
    const minCx = Math.min(...allPos.map(p => p.cx));
    const maxCx = Math.max(...allPos.map(p => p.cx));
    const maxCy = Math.max(...allPos.map(p => p.cy));
    const contentW = (maxCx - minCx + 1) * (NW + HG) - HG + 80;
    const contentH = (maxCy + 1) * (NH + VG) - VG + 80;
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const pad = 48;
    tfm.s = Math.min((sw - pad) / contentW, (sh - pad) / contentH, 1.2);
    tfm.x = (sw - contentW * tfm.s) / 2;
    tfm.y = (sh - contentH * tfm.s) / 2;
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

    const match = members.find(m => m.name.toLowerCase().includes(q));
    if (!match) { highlight = null; _renderContent(); return; }
    highlight = match.id;

    const visIds = new Set(_visibleMembers().map(m => m.id));
    if (!visIds.has(match.id)) {
      viewFilter = 'all';
      collapsedNodes = new Set();
      const btns = document.querySelectorAll('.tree-filter-btn');
      btns.forEach(b => b.classList.remove('active'));
      if (btns[0]) btns[0].classList.add('active');
      _buildLayout();
    }

    _renderContent();
    if (!nodePositions[match.id]) return;

    const stage = document.getElementById('tree-stage');
    if (!stage) return;

    // Collect nodes to show: match + spouse + 1 gen above + 1 gen below
    const focusIds = new Set([match.id]);
    const sid = spouseMap[match.id];
    if (sid && nodePositions[sid]) focusIds.add(sid);
    if (match.paternal_parent_id && nodePositions[match.paternal_parent_id]) focusIds.add(match.paternal_parent_id);
    if (match.maternal_parent_id && nodePositions[match.maternal_parent_id]) focusIds.add(match.maternal_parent_id);
    for (const m of members) {
      if ((m.paternal_parent_id === match.id || m.maternal_parent_id === match.id ||
           (sid && (m.paternal_parent_id === sid || m.maternal_parent_id === sid))) &&
          nodePositions[m.id]) {
        focusIds.add(m.id);
      }
    }

    // Compute pixel bounding box over all focus nodes
    const pxList = [...focusIds].map(id => _px(nodePositions[id].cx, nodePositions[id].cy));
    const minX = Math.min(...pxList.map(p => p.x));
    const maxX = Math.max(...pxList.map(p => p.x)) + NW;
    const minY = Math.min(...pxList.map(p => p.y));
    const maxY = Math.max(...pxList.map(p => p.y)) + NH;
    const pad = 60;
    const sw = stage.clientWidth, sh = stage.clientHeight;
    tfm.s = Math.min((sw - pad * 2) / (maxX - minX), (sh - pad * 2) / (maxY - minY), 1.5);
    tfm.s = Math.max(tfm.s, 0.2);
    tfm.x = sw / 2 - ((minX + maxX) / 2) * tfm.s;
    tfm.y = sh / 2 - ((minY + maxY) / 2) * tfm.s;
    _applyTfm();
  }

  function handleClick(id) { if (onMemberClick) onMemberClick(id); }

  function toggleFullscreen() {
    const stage = document.getElementById('tree-stage');
    if (!stage) return;
    if (!document.fullscreenElement) {
      stage.requestFullscreen && stage.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen && document.exitFullscreen().catch(() => {});
    }
  }

  function downloadPNG() {
    const svg = document.getElementById('tree-svg');
    if (!svg) return;
    const allPos = Object.values(nodePositions);
    if (!allPos.length) return;
    const maxCx = Math.max(...allPos.map(p => p.cx));
    const maxCy = Math.max(...allPos.map(p => p.cy));
    const W = (maxCx + 2) * (NW + HG) + 80, H = (maxCy + 2) * (NH + VG) + 80;

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

  return { init, update, zoom, fitView, resetView, handleClick, toggleCollapse, setFilter, setFocal, search, downloadPNG, toggleFullscreen };
})();
