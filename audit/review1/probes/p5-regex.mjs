import { parseRegex } from '../../../src/algorithms/regex.js';
import { buildDirect } from '../../../src/algorithms/direct.js';
const tree = (n) => n.type === 'leaf' ? n.symbol : `${n.type}(${n.children.map(tree).join(',')})`;
console.log('— 2.7 parser —');
for (const s of ['a|bc*', 'ab|c', '(a|b)*abb', 'a+?', 'a*b+c?', '((a))', '\\*\\(', '\\#a', 'a b', 'a||b', '(a|)', '(|a)', '()', '|a', 'a|', '*a', 'a\\', '(ab', 'ab)', '#', 'a#b', '', '(((a|b)*c)+)?'] ) {
  const r = parseRegex(s);
  console.log(JSON.stringify(s).padEnd(16), r.ok ? 'OK   ' + tree(r.ast) : `ERR  pos=${r.position} (1-based ${r.position + 1}) "${r.error}"`);
}
console.log('\n— 2.8 node properties vs hand derivation —');
const props = (src) => { const d = buildDirect(parseRegex(src).ast); return { d, rows: d.nodes.map((n) => `${n.type === 'leaf' ? n.symbol + n.pos : n.type}:${n.nullable ? 'T' : 'F'}:{${n.first}}:{${n.last}}`) }; };
const HAND = {
  '(a|b)*abb': { follow: { 1: [1, 2, 3], 2: [1, 2, 3], 3: [4], 4: [5], 5: [6], 6: [] },
    states: { A: [1, 2, 3], B: [1, 2, 3, 4], C: [1, 2, 3, 5], D: [1, 2, 3, 6] }, trans: 'A-a->B A-b->A B-a->B B-b->C C-a->B C-b->D D-a->B D-b->A', acc: ['D'] },
  '(ab|a)+b?': { follow: { 1: [2], 2: [1, 3, 4, 5], 3: [1, 3, 4, 5], 4: [5], 5: [] },
    states: { A: [1, 3], B: [1, 2, 3, 4, 5], C: [1, 3, 4, 5], D: [5] }, trans: 'A-a->B B-a->B B-b->C C-a->B C-b->D', acc: ['B', 'C', 'D'],
    nodes: ['a1:F:{1}:{1}', 'b2:F:{2}:{2}', 'cat:F:{1}:{2}', 'a3:F:{3}:{3}', 'or:F:{1,3}:{2,3}', 'plus:F:{1,3}:{2,3}', 'b4:F:{4}:{4}', 'opt:T:{4}:{4}', 'cat:F:{1,3}:{2,3,4}', '#5:F:{5}:{5}', 'cat:F:{1,3}:{5}'] },
  'a*b*c?': { follow: { 1: [1, 2, 3, 4], 2: [2, 3, 4], 3: [4], 4: [] },
    states: { A: [1, 2, 3, 4], B: [2, 3, 4], C: [4] }, trans: 'A-a->A A-b->B A-c->C B-b->B B-c->C', acc: ['A', 'B', 'C'],
    nodes: ['a1:F:{1}:{1}', 'star:T:{1}:{1}', 'b2:F:{2}:{2}', 'star:T:{2}:{2}', 'cat:T:{1,2}:{1,2}', 'c3:F:{3}:{3}', 'opt:T:{3}:{3}', 'cat:T:{1,2,3}:{1,2,3}', '#4:F:{4}:{4}', 'cat:F:{1,2,3,4}:{4}'] },
};
let p = 0, f = 0; const ok = (n, c, d = '') => { c ? p++ : f++; console.log(`${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : '  ' + d}`); };
for (const [src, H] of Object.entries(HAND)) {
  const { d, rows } = props(src);
  if (H.nodes) ok(`${src}: every node's nullable/firstpos/lastpos (${H.nodes.length} nodes)`, JSON.stringify(rows) === JSON.stringify(H.nodes), '\n   got  ' + rows.join(' ') + '\n   hand ' + H.nodes.join(' '));
  ok(`${src}: followpos`, JSON.stringify(d.followpos) === JSON.stringify(H.follow), JSON.stringify(d.followpos));
  const st = Object.fromEntries(d.dfa.states.map((s) => [s.name, s.positions]));
  ok(`${src}: DFA states`, JSON.stringify(st) === JSON.stringify(H.states), JSON.stringify(st));
  const tr = d.dfa.transitions.map((t) => `${t.from}-${t.symbol}->${t.to}`).sort().join(' ');
  ok(`${src}: DFA transitions`, tr === H.trans.split(' ').sort().join(' '), tr);
  ok(`${src}: accepting`, JSON.stringify(d.dfa.accepting) === JSON.stringify(H.acc), JSON.stringify(d.dfa.accepting));
  const order = d.leaves.map((l) => l.pos); ok(`${src}: leaves numbered 1..n left to right, end marker last`, order.every((v, i) => v === i + 1) && d.leaves.at(-1).isEnd);
}
console.log(`${p} passed, ${f} failed`);
