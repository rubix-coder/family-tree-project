const TreeViz = (() => {
  let members = [], treeId = null, myRole = 'viewer';
  let scale = 1;
  let onMemberClick = null;
  let nodePositions = {};
  let collapsedNodes = new Set();
  let spouseMap = {};
  let viewFilter = 'all'; // 'all' | 'paternal' | 'maternal'
  let focalId = null;

  const NODE_W = 140, NODE_H = 70, NODE_H_MIN = 38, H_GAP = 60, V_GAP = 100;

  function init(tid, mems, role, clickHandler) {
    treeId = tid; members = mems; myRole = role; onMemberClick = clickHandler;
    nodePositions = {}; collapsedNodes = new Set(); scale = 1;
    focalId = mems.length ? mems[mems.length - 1].id : null;
    buildSpouseMap();
    buildLayout();
    render();
  }

  function update(mems) {
    members = mems;
    buildSpouseMap();
    buildLayout();
    render();
  }

  function byId(id) { return members.find(m => m.id === id); }

  function buildSpouseMap() {
    spouseMap = {};
    for (const m of members) {
      if (m.spouse_id) {
        spouseMap[m.id] = m.spouse_id;
        spouseMap[m.spouse_id] = m.id;
      }
    }
  }

  function getVisibleMembers() {
    if (viewFilter === 'all') return members;
    const visible = new Set();
    const startId = focalId || (members.length ? members[members.length - 1].id : null);
    function addChain(id, depth) {
      if (!id || visible.has(id) || depth > 100) return;
      const m = byId(id);
      if (!m) return;
      visible.add(id);
      const sid = spouseMap[id];
      if (sid) visible.add(sid);
      if (viewFilter === 'paternal') addChain(m.paternal_parent_id, depth + 1);
      else addChain(m.maternal_parent_id, depth + 1);
    }
    addChain(startId, 0);
    return members.filter(m => visible.has(m.id));
  }

  function buildLayout() {
    nodePositions = {};
    const vis = getVisibleMembers();
    const placed = new Set();

    const childrenOf = {};
    for (const m of vis) {
      const parents = new Set([m.paternal_parent_id, m.maternal_parent_id].filter(Boolean));
      for (const pid of parents) {
        if (!childrenOf[pid]) childrenOf[pid] = [];
        if (!childrenOf[pid].includes(m.id)) childrenOf[pid].push(m.id);
      }
    }

    function getChildren(id) {
      return (childrenOf[id] || []).map(cid => vis.find(m => m.id === cid)).filter(Boolean);
    }

    const hasParents = new Set(vis.filter(m => m.paternal_parent_id || m.maternal_parent_id).map(m => m.id));

    const roots = vis.filter(m => {
      if (hasParents.has(m.id)) return false;
      const sid = spouseMap[m.id];
      if (!sid) return true;
      if (hasParents.has(sid)) return false;
      return m.id < sid;
    });
    if (!roots.length && vis.length) roots.push(vis[0]);

    function placeSubtree(member, depth, column) {
      if (placed.has(member.id)) return column;
      placed.add(member.id);

      const childIds = new Set();
      for (const c of getChildren(member.id)) childIds.add(c.id);
      const sid = spouseMap[member.id];
      if (sid) for (const c of getChildren(sid)) childIds.add(c.id);
      const children = [...childIds].map(id => vis.find(m => m.id === id)).filter(Boolean);

      let childCols = [], c = column;
      for (const child of children) {
        if (placed.has(child.id)) continue;
        c = placeSubtree(child, depth + 1, c);
        childCols.push(nodePositions[child.id] ? nodePositions[child.id].cx : c);
        c++;
      }

      const x = childCols.length ? (Math.min(...childCols) + Math.max(...childCols)) / 2 : column;
      nodePositions[member.id] = { cx: x, cy: depth };

      if (sid && !placed.has(sid)) {
        const spouse = vis.find(m => m.id === sid);
        if (spouse) {
          placed.add(spouse.id);
          nodePositions[spouse.id] = { cx: x + 1, cy: depth };
          c = Math.max(c, x + 2);
        }
      }
      return childCols.length ? c : column + 1;
    }

    let startCol = 0;
    for (const root of roots) {
      if (!placed.has(root.id)) startCol = placeSubtree(root, 0, startCol) + 1;
    }
    let extra = 0;
    for (const m of vis) {
      if (!nodePositions[m.id]) { nodePositions[m.id] = { cx: startCol + extra, cy: 0 }; extra++; }
    }
  }

  function toPixel(cx, cy) {
    return { x: cx * (NODE_W + H_GAP) + 40, y: cy * (NODE_H + V_GAP) + 40 };
  }

  function render() {
    const container = document.getElementById('tree-canvas');
    if (!container) return;

    const vis = getVisibleMembers();

    if (!vis.length) {
      container.innerHTML = `<div class="tree-empty"><div class="tree-empty-icon">🌳</div><p>No family members yet.</p>${myRole !== 'viewer' ? '<button class="btn btn-primary" onclick="App.showAddMember()">Add First Member</button>' : ''}</div>`;
      return;
    }

    const maxCx = Math.max(...Object.values(nodePositions).map(p => p.cx), 0);
    const maxCy = Math.max(...Object.values(nodePositions).map(p => p.cy), 0);
    const svgW = (maxCx + 2) * (NODE_W + H_GAP) + 80;
    const svgH = (maxCy + 1) * (NODE_H + V_GAP) + 80;

    // ── Edges ──────────────────────────────────────────────────────────
    let edgesHTML = '';

    // Spouse lines — bidirectional, drawn once
    const drawnSpouse = new Set();
    for (const m of vis) {
      const sid = spouseMap[m.id];
      if (!sid || !nodePositions[m.id] || !nodePositions[sid]) continue;
      const key = [m.id, sid].sort().join('|');
      if (drawnSpouse.has(key)) continue;
      drawnSpouse.add(key);
      const p1 = toPixel(nodePositions[m.id].cx, nodePositions[m.id].cy);
      const p2 = toPixel(nodePositions[sid].cx, nodePositions[sid].cy);
      edgesHTML += `<line x1="${p1.x + NODE_W / 2}" y1="${p1.y + NODE_H / 2}" x2="${p2.x + NODE_W / 2}" y2="${p2.y + NODE_H / 2}" stroke="#f472b6" stroke-width="2" stroke-dasharray="6,3" opacity="0.8"/>`;
    }

    // Parent-child lines — ONE line per child from couple midpoint or single parent
    for (const m of vis) {
      if (!nodePositions[m.id]) continue;
      const mpos = toPixel(nodePositions[m.id].cx, nodePositions[m.id].cy);
      const childCx = mpos.x + NODE_W / 2;
      const childTopY = mpos.y;

      const pid = m.paternal_parent_id;
      const mid = m.maternal_parent_id;
      const pPos = pid && nodePositions[pid] ? toPixel(nodePositions[pid].cx, nodePositions[pid].cy) : null;
      const mPos = mid && nodePositions[mid] ? toPixel(nodePositions[mid].cx, nodePositions[mid].cy) : null;

      let fromX, fromY, stroke;

      if (pPos && mPos && pid !== mid) {
        // Both parents in tree → single line from couple midpoint
        fromX = (pPos.x + NODE_W / 2 + mPos.x + NODE_W / 2) / 2;
        fromY = pPos.y + NODE_H;
        stroke = '#6366f1';
      } else if (pPos) {
        fromX = pPos.x + NODE_W / 2;
        fromY = pPos.y + NODE_H;
        stroke = '#c9a84c';
      } else if (mPos) {
        fromX = mPos.x + NODE_W / 2;
        fromY = mPos.y + NODE_H;
        stroke = '#a78bfa';
      } else continue;

      const ctrlY = fromY + (childTopY - fromY) * 0.5;
      edgesHTML += `<path d="M${fromX},${fromY} C${fromX},${ctrlY} ${childCx},${ctrlY} ${childCx},${childTopY}" stroke="${stroke}" stroke-width="2" fill="none" opacity="0.8"/>`;
    }

    // ── Nodes ──────────────────────────────────────────────────────────
    let nodesHTML = '';
    for (const m of vis) {
      const pos = nodePositions[m.id];
      if (!pos) continue;
      const { x, y } = toPixel(pos.cx, pos.cy);
      const collapsed = collapsedNodes.has(m.id);
      const nH = collapsed ? NODE_H_MIN : NODE_H;
      const gc = m.gender === 'male' ? '#3b82f6' : m.gender === 'female' ? '#ec4899' : '#8b5cf6';
      const initials = m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

      if (collapsed) {
        nodesHTML += `
          <g class="tree-node" data-id="${m.id}" style="cursor:pointer">
            <rect x="${x}" y="${y}" width="${NODE_W}" height="${nH}" rx="8" fill="white" stroke="${gc}" stroke-width="1.5" filter="url(#shadow)" onclick="TreeViz.handleClick('${m.id}')"/>
            <circle cx="${x + 20}" cy="${y + nH / 2}" r="13" fill="${gc}" opacity="0.15" onclick="TreeViz.handleClick('${m.id}')"/>
            <text x="${x + 20}" y="${y + nH / 2 + 4}" text-anchor="middle" font-size="10" font-weight="700" fill="${gc}" onclick="TreeViz.handleClick('${m.id}')">${initials}</text>
            <text x="${x + 38}" y="${y + nH / 2 + 4}" font-size="10" font-weight="600" fill="#1e293b" onclick="TreeViz.handleClick('${m.id}')">${escapeXml(m.name.length > 13 ? m.name.slice(0, 12) + '…' : m.name)}</text>
            <text x="${x + NODE_W - 4}" y="${y + nH / 2 + 4}" text-anchor="end" font-size="14" fill="${gc}" opacity="0.7" onclick="event.stopPropagation();TreeViz.toggleCollapse('${m.id}')" style="cursor:pointer" title="Expand">⊕</text>
          </g>`;
      } else {
        const photoHTML = m.photo
          ? `<image href="${m.photo}" x="${x + 8}" y="${y + 8}" width="36" height="36" clip-path="url(#cp${m.id.slice(0, 8)})" preserveAspectRatio="xMidYMid slice"/><clipPath id="cp${m.id.slice(0, 8)}"><circle cx="${x + 26}" cy="${y + 26}" r="18"/></clipPath>`
          : `<circle cx="${x + 26}" cy="${y + 26}" r="18" fill="${gc}" opacity="0.2"/><text x="${x + 26}" y="${y + 31}" text-anchor="middle" font-size="12" font-weight="700" fill="${gc}">${initials}</text>`;
        const lifespan = [m.birth_year, m.death_year].filter(Boolean).join(' – ');
        const fs = m.name.length > 14 ? '10' : m.name.length > 10 ? '11' : '12';

        nodesHTML += `
          <g class="tree-node" data-id="${m.id}" style="cursor:pointer">
            <rect x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="10" fill="white" stroke="${gc}" stroke-width="2" filter="url(#shadow)" onclick="TreeViz.handleClick('${m.id}')"/>
            ${photoHTML}
            <text x="${x + 54}" y="${y + 24}" font-size="${fs}" font-weight="600" fill="#1e293b" dominant-baseline="middle" onclick="TreeViz.handleClick('${m.id}')">${escapeXml(m.name.length > 16 ? m.name.slice(0, 15) + '…' : m.name)}</text>
            ${lifespan ? `<text x="${x + 54}" y="${y + 42}" font-size="9" fill="#64748b" onclick="TreeViz.handleClick('${m.id}')">${escapeXml(lifespan)}</text>` : ''}
            ${m.death_year ? `<text x="${x + NODE_W - 20}" y="${y + 14}" font-size="10" text-anchor="end" fill="#94a3b8">✝</text>` : ''}
            <text x="${x + NODE_W - 4}" y="${y + 14}" text-anchor="end" font-size="14" fill="#94a3b8" onclick="event.stopPropagation();TreeViz.toggleCollapse('${m.id}')" style="cursor:pointer" title="Minimize">⊖</text>
          </g>`;
      }
    }

    // ── Focal person select ─────────────────────────────────────────────
    const focalOpts = members.map(m =>
      `<option value="${m.id}" ${m.id === focalId ? 'selected' : ''}>${escapeXml(m.name)}</option>`
    ).join('');

    container.innerHTML = `
      <div class="tree-toolbar">
        <div class="tree-filter-group">
          <span class="tree-toolbar-label">View from:</span>
          <select class="tree-select" onchange="TreeViz.setFocal(this.value)">${focalOpts}</select>
          <button class="tree-filter-btn ${viewFilter === 'all' ? 'active' : ''}" onclick="TreeViz.setFilter('all')">All</button>
          <button class="tree-filter-btn ${viewFilter === 'paternal' ? 'active' : ''}" onclick="TreeViz.setFilter('paternal')">👨 Paternal</button>
          <button class="tree-filter-btn ${viewFilter === 'maternal' ? 'active' : ''}" onclick="TreeViz.setFilter('maternal')">👩 Maternal</button>
        </div>
        <div class="tree-controls-row">
          <button class="tree-btn" onclick="TreeViz.zoom(0.2)" title="Zoom in">+</button>
          <button class="tree-btn" onclick="TreeViz.zoom(-0.2)" title="Zoom out">−</button>
          <button class="tree-btn" onclick="TreeViz.resetView()" title="Reset view">⊙</button>
          <button class="tree-btn tree-btn-dl" onclick="TreeViz.downloadPNG()" title="Download PNG">↓ PNG</button>
          <button class="tree-btn tree-btn-dl" onclick="TreeViz.downloadPDF()" title="Download PDF">↓ PDF</button>
        </div>
      </div>
      <div class="tree-scroll" id="tree-scroll-wrap">
        <svg id="tree-svg" width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg" style="transform:scale(${scale});transform-origin:top left">
          <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#00000022"/>
            </filter>
          </defs>
          ${edgesHTML}
          ${nodesHTML}
        </svg>
      </div>`;

    setupPan();
  }

  function escapeXml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function setupPan() {
    const wrap = document.getElementById('tree-scroll-wrap');
    if (!wrap) return;
    let panning = false, startX = 0, startY = 0, scrollLeft = 0, scrollTop = 0;
    wrap.addEventListener('mousedown', e => {
      if (e.target.closest('.tree-node')) return;
      panning = true; startX = e.clientX; startY = e.clientY;
      scrollLeft = wrap.scrollLeft; scrollTop = wrap.scrollTop;
      wrap.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', e => {
      if (!panning) return;
      wrap.scrollLeft = scrollLeft - (e.clientX - startX);
      wrap.scrollTop = scrollTop - (e.clientY - startY);
    });
    window.addEventListener('mouseup', () => { panning = false; if (wrap) wrap.style.cursor = ''; });
    wrap.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      panning = true; startX = e.touches[0].clientX; startY = e.touches[0].clientY;
      scrollLeft = wrap.scrollLeft; scrollTop = wrap.scrollTop;
    }, { passive: true });
    wrap.addEventListener('touchmove', e => {
      if (!panning || e.touches.length !== 1) return;
      wrap.scrollLeft = scrollLeft - (e.touches[0].clientX - startX);
      wrap.scrollTop = scrollTop - (e.touches[0].clientY - startY);
    }, { passive: true });
    wrap.addEventListener('touchend', () => { panning = false; });
  }

  function zoom(delta) {
    scale = Math.min(2.5, Math.max(0.25, scale + delta));
    const svg = document.getElementById('tree-svg');
    if (svg) svg.style.transform = `scale(${scale})`;
  }

  function resetView() {
    scale = 1;
    const svg = document.getElementById('tree-svg');
    if (svg) svg.style.transform = 'scale(1)';
    const wrap = document.getElementById('tree-scroll-wrap');
    if (wrap) { wrap.scrollLeft = 0; wrap.scrollTop = 0; }
  }

  function toggleCollapse(id) {
    if (collapsedNodes.has(id)) collapsedNodes.delete(id);
    else collapsedNodes.add(id);
    buildLayout();
    render();
  }

  function setFilter(f) {
    viewFilter = f;
    buildLayout();
    render();
  }

  function setFocal(id) {
    focalId = id;
    if (viewFilter !== 'all') { buildLayout(); render(); }
    else render(); // re-render to update selected state in dropdown
  }

  function downloadPNG() {
    const svg = document.getElementById('tree-svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svg.width.baseVal.value * scale;
      canvas.height = svg.height.baseVal.value * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f8f5ee';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const link = document.createElement('a');
      link.download = 'family-tree.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  }

  function downloadPDF() {
    const svg = document.getElementById('tree-svg');
    if (!svg) return;
    const svgClone = svg.cloneNode(true);
    svgClone.style.transform = '';
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const win = window.open('', '_blank');
    if (!win) { alert('Allow pop-ups to download PDF'); return; }
    win.document.write(`<!DOCTYPE html><html><head><title>Family Tree</title>
      <style>body{margin:0;background:#f8f5ee}svg{display:block;max-width:100%}
      @media print{@page{size:landscape;margin:8mm}body{background:#fff}}</style>
      </head><body>${svgData}<script>window.onload=()=>{window.print();}<\/script></body></html>`);
    win.document.close();
  }

  function handleClick(id) {
    if (onMemberClick) onMemberClick(id);
  }

  return { init, update, zoom, resetView, handleClick, toggleCollapse, setFilter, setFocal, downloadPNG, downloadPDF };
})();
