import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, PanResponder } from 'react-native';
import Svg, { G, Rect, Circle, Path, Line, Text as SvgText, Defs, ClipPath } from 'react-native-svg';

const NODE_W = 130, NODE_H = 65, H_GAP = 50, V_GAP = 90;

function buildSpouseMap(members) {
  const m = {};
  for (const mem of members) {
    if (mem.spouse_id) { m[mem.id] = mem.spouse_id; m[mem.spouse_id] = mem.id; }
  }
  return m;
}

function buildChildrenOf(members) {
  const c = {};
  for (const m of members) {
    const parents = new Set([m.paternal_parent_id, m.maternal_parent_id].filter(Boolean));
    for (const pid of parents) { if (!c[pid]) c[pid] = []; if (!c[pid].includes(m.id)) c[pid].push(m.id); }
  }
  return c;
}

function buildLayout(members) {
  const spouseMap = buildSpouseMap(members);
  const childrenOf = buildChildrenOf(members);
  const nodePositions = {};
  const placed = new Set();

  function getChildren(id) {
    return (childrenOf[id] || []).map(cid => members.find(m => m.id === cid)).filter(Boolean);
  }

  const hasParents = new Set(members.filter(m => m.paternal_parent_id || m.maternal_parent_id).map(m => m.id));
  const roots = members.filter(m => {
    if (hasParents.has(m.id)) return false;
    const sid = spouseMap[m.id];
    if (!sid) return true;
    if (hasParents.has(sid)) return false;
    return m.id < sid;
  });
  if (!roots.length && members.length) roots.push(members[0]);

  function placeSubtree(member, depth, column) {
    if (placed.has(member.id)) return column;
    placed.add(member.id);
    const childIds = new Set();
    for (const c of getChildren(member.id)) childIds.add(c.id);
    const sid = spouseMap[member.id];
    if (sid) for (const c of getChildren(sid)) childIds.add(c.id);
    const children = [...childIds].map(id => members.find(m => m.id === id)).filter(Boolean);

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
      const spouse = members.find(m => m.id === sid);
      if (spouse) { placed.add(spouse.id); nodePositions[spouse.id] = { cx: x + 1, cy: depth }; c = Math.max(c, x + 2); }
    }
    return childCols.length ? c : column + 1;
  }

  let startCol = 0;
  for (const root of roots) {
    if (!placed.has(root.id)) startCol = placeSubtree(root, 0, startCol) + 1;
  }
  let extra = 0;
  for (const m of members) {
    if (!nodePositions[m.id]) { nodePositions[m.id] = { cx: startCol + extra, cy: 0 }; extra++; }
  }
  return { nodePositions, spouseMap };
}

function toPixel(cx, cy) {
  return { x: cx * (NODE_W + H_GAP) + 30, y: cy * (NODE_H + V_GAP) + 30 };
}

function genderColor(gender) {
  return gender === 'male' ? '#3b82f6' : gender === 'female' ? '#ec4899' : '#8b5cf6';
}

export default function TreeVisualization({ members, onMemberPress }) {
  const [scale, setScale] = useState(0.85);

  if (!members || !members.length) {
    return (
      <View style={s.empty}>
        <Text style={{ fontSize: 40 }}>🌳</Text>
        <Text style={s.emptyText}>No members yet</Text>
      </View>
    );
  }

  const { nodePositions, spouseMap } = buildLayout(members);
  const maxCx = Math.max(...Object.values(nodePositions).map(p => p.cx), 0);
  const maxCy = Math.max(...Object.values(nodePositions).map(p => p.cy), 0);
  const svgW = (maxCx + 2) * (NODE_W + H_GAP) + 60;
  const svgH = (maxCy + 1) * (NODE_H + V_GAP) + 60;

  // Build edges
  const edges = [];
  const drawnSpouse = new Set();
  for (const m of members) {
    const sid = spouseMap[m.id];
    if (sid && nodePositions[m.id] && nodePositions[sid]) {
      const key = [m.id, sid].sort().join('|');
      if (!drawnSpouse.has(key)) {
        drawnSpouse.add(key);
        const p1 = toPixel(nodePositions[m.id].cx, nodePositions[m.id].cy);
        const p2 = toPixel(nodePositions[sid].cx, nodePositions[sid].cy);
        edges.push({ type: 'spouse', x1: p1.x + NODE_W / 2, y1: p1.y + NODE_H / 2, x2: p2.x + NODE_W / 2, y2: p2.y + NODE_H / 2 });
      }
    }
    if (!nodePositions[m.id]) continue;
    const mpos = toPixel(nodePositions[m.id].cx, nodePositions[m.id].cy);
    const childCx = mpos.x + NODE_W / 2, childTopY = mpos.y;
    const pid = m.paternal_parent_id, mid = m.maternal_parent_id;
    const pPos = pid && nodePositions[pid] ? toPixel(nodePositions[pid].cx, nodePositions[pid].cy) : null;
    const mPos = mid && nodePositions[mid] ? toPixel(nodePositions[mid].cx, nodePositions[mid].cy) : null;
    let fromX, fromY, color;
    if (pPos && mPos && pid !== mid) {
      fromX = (pPos.x + NODE_W / 2 + mPos.x + NODE_W / 2) / 2; fromY = pPos.y + NODE_H; color = '#6366f1';
    } else if (pPos) { fromX = pPos.x + NODE_W / 2; fromY = pPos.y + NODE_H; color = '#c9a84c'; }
    else if (mPos) { fromX = mPos.x + NODE_W / 2; fromY = mPos.y + NODE_H; color = '#a78bfa'; }
    else continue;
    const ctrlY = fromY + (childTopY - fromY) * 0.5;
    edges.push({ type: 'parent', fromX, fromY, childCx, childTopY, ctrlY, color });
  }

  return (
    <View style={s.container}>
      <View style={s.zoomBar}>
        <TouchableOpacity style={s.zoomBtn} onPress={() => setScale(sc => Math.min(2, sc + 0.15))}>
          <Text style={s.zoomText}>+</Text>
        </TouchableOpacity>
        <Text style={s.zoomLabel}>{Math.round(scale * 100)}%</Text>
        <TouchableOpacity style={s.zoomBtn} onPress={() => setScale(sc => Math.max(0.3, sc - 0.15))}>
          <Text style={s.zoomText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.zoomBtn} onPress={() => setScale(0.85)}>
          <Text style={s.zoomText}>⊙</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Svg width={svgW * scale} height={svgH * scale} viewBox={`0 0 ${svgW} ${svgH}`}>
            {/* Edges */}
            {edges.map((e, i) => e.type === 'spouse'
              ? <Line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="#f472b6" strokeWidth={2} strokeDasharray="6,3" opacity={0.8} />
              : <Path key={i} d={`M${e.fromX},${e.fromY} C${e.fromX},${e.ctrlY} ${e.childCx},${e.ctrlY} ${e.childCx},${e.childTopY}`} stroke={e.color} strokeWidth={2} fill="none" opacity={0.8} />
            )}

            {/* Nodes */}
            {members.map(m => {
              const pos = nodePositions[m.id];
              if (!pos) return null;
              const { x, y } = toPixel(pos.cx, pos.cy);
              const gc = genderColor(m.gender);
              const initials = m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
              const lifespan = [m.birth_year, m.death_year].filter(Boolean).join('–');
              const nameDisplay = m.name.length > 15 ? m.name.slice(0, 14) + '…' : m.name;
              return (
                <G key={m.id} onPress={() => onMemberPress && onMemberPress(m.id)}>
                  <Rect x={x} y={y} width={NODE_W} height={NODE_H} rx={10} fill="white" stroke={gc} strokeWidth={2} />
                  <Circle cx={x + 24} cy={y + NODE_H / 2} r={17} fill={gc} opacity={0.15} />
                  <SvgText x={x + 24} y={y + NODE_H / 2 + 5} textAnchor="middle" fontSize={11} fontWeight="700" fill={gc}>{initials}</SvgText>
                  <SvgText x={x + 48} y={y + 26} fontSize={11} fontWeight="600" fill="#1e293b">{nameDisplay}</SvgText>
                  {lifespan ? <SvgText x={x + 48} y={y + 44} fontSize={9} fill="#94a3b8">{lifespan}</SvgText> : null}
                </G>
              );
            })}
          </Svg>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { color: '#64748b', fontSize: 16 },
  zoomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', padding: 8, gap: 6, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  zoomBtn: { width: 32, height: 32, backgroundColor: '#f1f5f9', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  zoomText: { fontSize: 16, color: '#1a2744', fontWeight: '700' },
  zoomLabel: { fontSize: 12, color: '#64748b', minWidth: 36, textAlign: 'center' },
});
