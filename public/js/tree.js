const TreeViz = (() => {
  let members = [], treeId = null, myRole = 'viewer';
  let scale = 1, panX = 0, panY = 0;
  let dragging = null, dragStartX = 0, dragStartY = 0, nodePositions = {};
  let onMemberClick = null;

  const NODE_W = 140, NODE_H = 70, H_GAP = 60, V_GAP = 100;

  function init(tid, mems, role, clickHandler) {
    treeId = tid;
    members = mems;
    myRole = role;
    onMemberClick = clickHandler;
    nodePositions = {};
    scale = 1; panX = 0; panY = 0;
    buildLayout();
    render();
  }

  function update(mems) {
    members = mems;
    buildLayout();
    render();
  }

  function byId(id) { return members.find(m => m.id === id); }

  function buildLayout() {
    nodePositions = {};
    const roots = members.filter(m => !m.paternal_parent_id && !m.maternal_parent_id);
    if (!roots.length && members.length) roots.push(members[0]);

    const placed = new Set();
    let col = 0;

    function placeSubtree(member, depth, column) {
      if (placed.has(member.id)) return column;
      placed.add(member.id);

      const children = members.filter(m => m.paternal_parent_id === member.id || m.maternal_parent_id === member.id);

      let childCols = [];
      let c = column;
      for (const child of children) {
        c = placeSubtree(child, depth + 1, c);
        childCols.push(nodePositions[child.id] ? nodePositions[child.id].cx : c);
        c++;
      }

      const x = childCols.length ? (Math.min(...childCols) + Math.max(...childCols)) / 2 : column;
      nodePositions[member.id] = { cx: x, cy: depth };

      if (member.spouse_id && !placed.has(member.spouse_id)) {
        const spouse = byId(member.spouse_id);
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
      startCol = placeSubtree(root, 0, startCol) + 1;
    }

    let placed2 = 0;
    for (const m of members) {
      if (!nodePositions[m.id]) {
        nodePositions[m.id] = { cx: startCol + placed2, cy: 0 };
        placed2++;
      }
    }
  }

  function toPixel(cx, cy) {
    return { x: cx * (NODE_W + H_GAP) + 40, y: cy * (NODE_H + V_GAP) + 40 };
  }

  function render() {
    const container = document.getElementById('tree-canvas');
    if (!container) return;

    if (!members.length) {
      container.innerHTML = `<div class="tree-empty"><div class="tree-empty-icon">🌳</div><p>No family members yet.</p>${myRole !== 'viewer' ? '<button class="btn btn-primary" onclick="App.showAddMember()">Add First Member</button>' : ''}</div>`;
      return;
    }

    const maxCx = Math.max(...Object.values(nodePositions).map(p => p.cx), 0);
    const maxCy = Math.max(...Object.values(nodePositions).map(p => p.cy), 0);
    const svgW = (maxCx + 1) * (NODE_W + H_GAP) + 80;
    const svgH = (maxCy + 1) * (NODE_H + V_GAP) + 80;

    let edgesHTML = '';
    for (const m of members) {
      const pos = nodePositions[m.id];
      if (!pos) continue;
      const { x, y } = toPixel(pos.cx, pos.cy);
      const cx = x + NODE_W / 2, cy = y + NODE_H / 2;

      if (m.paternal_parent_id && nodePositions[m.paternal_parent_id]) {
        const pp = toPixel(nodePositions[m.paternal_parent_id].cx, nodePositions[m.paternal_parent_id].cy);
        const px = pp.x + NODE_W / 2, py = pp.y + NODE_H / 2;
        edgesHTML += `<path d="M${px},${py + NODE_H / 2} C${px},${cy - V_GAP / 2} ${cx},${cy - V_GAP / 2} ${cx},${cy - NODE_H / 2}" stroke="#c9a84c" stroke-width="2" fill="none" opacity="0.7"/>`;
      }
      if (m.maternal_parent_id && nodePositions[m.maternal_parent_id]) {
        const mp = toPixel(nodePositions[m.maternal_parent_id].cx, nodePositions[m.maternal_parent_id].cy);
        const mx = mp.x + NODE_W / 2, my2 = mp.y + NODE_H / 2;
        edgesHTML += `<path d="M${mx},${my2 + NODE_H / 2} C${mx},${cy - V_GAP / 2} ${cx},${cy - V_GAP / 2} ${cx},${cy - NODE_H / 2}" stroke="#a78bfa" stroke-width="2" fill="none" opacity="0.7"/>`;
      }
      if (m.spouse_id && nodePositions[m.spouse_id] && m.id < m.spouse_id) {
        const sp = toPixel(nodePositions[m.spouse_id].cx, nodePositions[m.spouse_id].cy);
        const sx = sp.x + NODE_W / 2, sy = sp.y + NODE_H / 2;
        edgesHTML += `<line x1="${cx}" y1="${cy}" x2="${sx}" y2="${sy}" stroke="#f472b6" stroke-width="2" stroke-dasharray="6,3" opacity="0.8"/>`;
      }
    }

    let nodesHTML = '';
    for (const m of members) {
      const pos = nodePositions[m.id];
      if (!pos) continue;
      const { x, y } = toPixel(pos.cx, pos.cy);
      const genderColor = m.gender === 'male' ? '#3b82f6' : m.gender === 'female' ? '#ec4899' : '#8b5cf6';
      const initials = m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const photoHTML = m.photo
        ? `<image href="${m.photo}" x="${x + 8}" y="${y + 8}" width="36" height="36" clip-path="url(#cp${m.id.slice(0, 8)})" preserveAspectRatio="xMidYMid slice"/><clipPath id="cp${m.id.slice(0, 8)}"><circle cx="${x + 26}" cy="${y + 26}" r="18"/></clipPath>`
        : `<circle cx="${x + 26}" cy="${y + 26}" r="18" fill="${genderColor}" opacity="0.2"/><text x="${x + 26}" y="${y + 31}" text-anchor="middle" font-size="12" font-weight="700" fill="${genderColor}">${initials}</text>`;
      const lifespan = [m.birth_year, m.death_year].filter(Boolean).join(' – ');
      const nameLen = m.name.length;
      const fontSize = nameLen > 14 ? '10' : nameLen > 10 ? '11' : '12';

      nodesHTML += `
        <g class="tree-node" data-id="${m.id}" onclick="TreeViz.handleClick('${m.id}')" style="cursor:pointer">
          <rect x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="10" ry="10" fill="white" stroke="${genderColor}" stroke-width="2" filter="url(#shadow)"/>
          ${photoHTML}
          <text x="${x + 54}" y="${y + 24}" font-size="${fontSize}" font-weight="600" fill="#1e293b" dominant-baseline="middle">${escapeXml(m.name.length > 16 ? m.name.slice(0, 15) + '…' : m.name)}</text>
          ${lifespan ? `<text x="${x + 54}" y="${y + 42}" font-size="9" fill="#64748b">${escapeXml(lifespan)}</text>` : ''}
          ${m.death_year ? `<text x="${x + NODE_W - 8}" y="${y + 14}" font-size="10" text-anchor="end" fill="#94a3b8">✝</text>` : ''}
        </g>`;
    }

    container.innerHTML = `
      <div class="tree-controls">
        <button class="tree-btn" onclick="TreeViz.zoom(0.2)" title="Zoom in">+</button>
        <button class="tree-btn" onclick="TreeViz.zoom(-0.2)" title="Zoom out">−</button>
        <button class="tree-btn" onclick="TreeViz.resetView()" title="Reset view">⊙</button>
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
    window.addEventListener('mouseup', () => { panning = false; wrap.style.cursor = ''; });
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
    wrap.addEventListener('touchend', () => panning = false);
  }

  function zoom(delta) {
    scale = Math.min(2, Math.max(0.3, scale + delta));
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

  function handleClick(id) {
    if (onMemberClick) onMemberClick(id);
  }

  return { init, update, zoom, resetView, handleClick };
})();
