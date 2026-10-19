/* "Ethereum's code" page (ethereum.html): an interactive explainer of go-ethereum v1.0.0, the Frontier client.
   Keccak-256, RLP, the Merkle-Patricia trie and a small EVM are implemented here in plain JS; the mainnet genesis
   header is rebuilt and checked against its known hash on load. No libraries. */
(function () {
"use strict";

/* ---------- Keccak-256 (the pre-standard SHA-3 Ethereum uses), RLP, and a Merkle-Patricia trie ---------- */
const RC = [1,0,32898,0,32906,2147483648,2147516416,2147483648,32907,0,2147483649,0,2147516545,2147483648,32777,2147483648,138,0,136,0,2147516425,0,2147483658,0,2147516555,0,139,2147483648,32905,2147483648,32771,2147483648,32770,2147483648,128,2147483648,32778,0,2147483658,2147483648,2147516545,2147483648,32896,2147483648,2147483649,0,2147516424,2147483648];
function keccakF(s) {
  const c = new Uint32Array(10), b = new Uint32Array(50);
  for (let r = 0; r < 48; r += 2) {
    for (let x = 0; x < 10; x++) c[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
    for (let x = 0; x < 10; x += 2) {
      const x1 = (x + 2) % 10, x4 = (x + 8) % 10;
      const h = c[x4] ^ ((c[x1] << 1) | (c[x1 + 1] >>> 31)), l = c[x4 + 1] ^ ((c[x1 + 1] << 1) | (c[x1] >>> 31));
      for (let y = 0; y < 50; y += 10) { s[y + x] ^= h; s[y + x + 1] ^= l; }
    }
    // rho + pi
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
      const i = 2 * (x + 5 * y), rot = ROT[x + 5 * y], X = y, Y = (2 * x + 3 * y) % 5, j = 2 * (X + 5 * Y);
      let lo = s[i], hi = s[i + 1];
      if (rot >= 32) { const t = lo; lo = hi; hi = t; }
      const r2 = rot % 32;
      b[j] = r2 ? (lo << r2) | (hi >>> (32 - r2)) : lo;
      b[j + 1] = r2 ? (hi << r2) | (lo >>> (32 - r2)) : hi;
    }
    for (let y = 0; y < 50; y += 10) for (let x = 0; x < 10; x++) s[y + x] = b[y + x] ^ (~b[y + (x + 2) % 10] & b[y + (x + 4) % 10]);
    s[0] ^= RC[r]; s[1] ^= RC[r + 1];
  }
}
const ROT = [0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14];
function keccak256(msg) {
  const rate = 136, s = new Uint32Array(50);
  const n = Math.floor(msg.length / rate) + 1, p = new Uint8Array(n * rate);
  p.set(msg); p[msg.length] ^= 0x01; p[p.length - 1] ^= 0x80;
  const dv = new DataView(p.buffer);
  for (let o = 0; o < p.length; o += rate) {
    for (let i = 0; i < rate / 4; i++) s[i] ^= dv.getUint32(o + i * 4, true);
    keccakF(s);
  }
  const out = new Uint8Array(32), ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, s[i], true);
  return out;
}
const hex = u => Array.from(u, x => x.toString(16).padStart(2, "0")).join("");
const unhex = s => Uint8Array.from((s.replace(/^0x/, "").length % 2 ? "0" : "") .concat(s.replace(/^0x/, "")).match(/../g) || [], x => parseInt(x, 16));
const utf8 = s => new TextEncoder().encode(s);
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
const bigBytes = v => { v = BigInt(v); if (v === 0n) return new Uint8Array(0); let h = v.toString(16); if (h.length % 2) h = "0" + h; return unhex(h); };

// RLP: a byte string or a list of items (rlp/encode.go)
function rlp(x) {
  if (x instanceof Uint8Array) {
    if (x.length === 1 && x[0] < 0x80) return x;
    return cat(rlpLen(x.length, 0x80), x);
  }
  const body = cat(...x.map(rlp));
  return cat(rlpLen(body.length, 0xc0), body);
}
function rlpLen(n, off) {
  if (n < 56) return Uint8Array.of(off + n);
  const l = bigBytes(n);
  return cat(Uint8Array.of(off + 55 + l.length), l);
}

// Merkle-Patricia trie: nibble paths, leaf / extension / branch nodes, hex-prefix keys (trie/encoding.go)
const nibbles = b => { const o = []; for (const x of b) o.push(x >> 4, x & 15); return o; };
function hp(nib, leaf) {   // CompactEncode
  const odd = nib.length % 2, flag = 2 * (leaf ? 1 : 0) + odd;
  const a = odd ? [flag, ...nib] : [flag, 0, ...nib];
  const o = new Uint8Array(a.length / 2);
  for (let i = 0; i < a.length; i += 2) o[i / 2] = 16 * a[i] + a[i + 1];
  return o;
}
function trieInsert(node, path, value) {
  if (!node) return { t: "leaf", path, value };
  if (node.t === "leaf" || node.t === "ext") {
    let k = 0; while (k < path.length && k < node.path.length && path[k] === node.path[k]) k++;
    if (node.t === "leaf" && k === path.length && k === node.path.length) return { ...node, value };
    if (node.t === "ext" && k === node.path.length) return { ...node, child: trieInsert(node.child, path.slice(k), value) };
    const br = { t: "branch", kids: new Array(16).fill(null), value: null };
    if (node.t === "leaf") {
      if (k === node.path.length) br.value = node.value; else br.kids[node.path[k]] = { t: "leaf", path: node.path.slice(k + 1), value: node.value };
    } else {
      const rest = node.path.slice(k + 1);
      br.kids[node.path[k]] = rest.length ? { t: "ext", path: rest, child: node.child } : node.child;
    }
    if (k === path.length) br.value = value; else br.kids[path[k]] = trieInsert(br.kids[path[k]], path.slice(k + 1), value);
    return k ? { t: "ext", path: path.slice(0, k), child: br } : br;
  }
  const br = { ...node, kids: node.kids.slice() };
  if (!path.length) br.value = value; else br.kids[path[0]] = trieInsert(br.kids[path[0]], path.slice(1), value);
  return br;
}
function nodeRlpItem(n) {   // the structure a parent embeds: the node itself if its RLP is < 32 bytes, else its hash
  const enc = rlp(nodeList(n));
  return enc.length < 32 ? nodeList(n) : keccak256(enc);
}
function nodeList(n) {
  if (n.t === "leaf") return [hp(n.path, true), n.value];
  if (n.t === "ext") return [hp(n.path, false), nodeRlpItem(n.child)];
  return [...n.kids.map(k => (k ? nodeRlpItem(k) : new Uint8Array(0))), n.value || new Uint8Array(0)];
}
const trieRoot = n => n ? keccak256(rlp(nodeList(n))) : keccak256(rlp(new Uint8Array(0)));

/* ================================================================ page helpers */
const $ = id => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = n => Number(n).toLocaleString("en-US");
const css = v => `var(${v})`;
const short = h => h.slice(0, 8) + "…" + h.slice(-4);
const z = n => new Uint8Array(n);
function svgIn(host, w, h) {
  host.innerHTML = "";
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", `0 0 ${w} ${h}`);
  host.appendChild(s);
  return s;
}
function el(parent, tag, attrs, text) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  parent.appendChild(e);
  return e;
}
const TX = (size, fill = "var(--muted)", extra = "") => ({ "font-size": size, style: `fill:${fill};font-family:var(--f-text);${extra}` });
const WEI = 10n ** 18n, GWEI = 10n ** 9n;
const eth = (wei, dp = 6) => { const neg = wei < 0n; if (neg) wei = -wei; const s = (Number(wei / 10n ** 9n) / 1e9).toFixed(dp).replace(/\.?0+$/, ""); return (neg ? "−" : "") + s; };
function parseEth(s) {
  const m = String(s).trim().match(/^(\d*)(?:\.(\d{0,18}))?$/); if (!m) return null;
  return BigInt(m[1] || "0") * WEI + BigInt(((m[2] || "") + "0".repeat(18)).slice(0, 18));
}

/* ================================================================ code panes (Go) */
const GO_KW = /\b(func|return|if|else|for|range|var|const|type|struct|switch|case|default|fallthrough|continue|break|package|import|nil|true|false|go|defer|map|interface|make|new|append|len|panic)\b/;
const GO_TY = /\b(uint64|uint|int64|int|byte|string|bool|error|big\.Int|common\.Hash|common\.Address|[A-Z]\w*Node|Node|Trie|Header|Transaction|StateObject|StateDB|BlockNonce|Bloom|OpCode|Vm|Context)\b/;
function highlight(line) {
  const re = new RegExp(`(\\/\\/.*$)|("(?:\\\\.|[^"\\\\])*"|\`[^\`]*\`)|\\b(0x[0-9a-fA-F]+|\\d+(?:e\\+\\d+)?)\\b|${GO_KW.source}|${GO_TY.source}|([A-Za-z_]\\w*)(?=\\()`, "g");
  let out = "", at = 0, m;
  while ((m = re.exec(line))) {
    out += esc(line.slice(at, m.index));
    const cls = m[1] ? "com" : m[2] ? "str" : m[3] ? "num" : m[4] ? "kw" : m[5] ? "ty" : "fn";
    out += `<span class="tk-${cls}">${esc(m[0])}</span>`;
    at = re.lastIndex;
    if (!m[0].length) re.lastIndex++;
  }
  return out + esc(line.slice(at));
}
const REPO = "https://github.com/ethereum/go-ethereum/blob/v1.0.0/";
function codePane(host, srcId) {
  const src = $(srcId), file = src.dataset.file, title = src.dataset.title;
  const ranges = src.dataset.ranges.split(",").map(r => r.split("-").map(Number));
  const lines = src.textContent.split("\n").map(l => l.replace(/\t/g, "    "));
  const ind = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
  let k = 0, body = "";
  const nums = [];
  ranges.forEach(([a, b], ri) => {
    if (ri) body += `<span class="ln gap">    ⋯</span>`;
    for (let n = a; n <= b; n++) { body += `<span class="ln" data-n="${n}">${highlight(lines[k].slice(ind)) || " "}</span>`; nums.push([n, src.textContent.split("\n")[k]]); k++; }
  });
  const a0 = ranges[0][0], b1 = ranges[ranges.length - 1][1];
  host.className = "code";
  host.innerHTML = `<div class="bar"><i></i><i></i><i></i><b>${file.split("/").pop()}</b><span class="t">· ${title}</span>
    <a href="${REPO}${file}#L${a0}-L${b1}" target="_blank" rel="noopener">source ↗</a></div><pre>${body}</pre>`;
  const spans = [...host.querySelectorAll(".ln[data-n]")];
  const focus = ls => {
    const set = new Set(ls);
    host.classList.toggle("focus", set.size > 0);
    spans.forEach(s => s.classList.toggle("on", set.has(+s.dataset.n)));
    const first = spans.find(s => set.has(+s.dataset.n)), pre = host.querySelector("pre");
    if (first && pre.scrollHeight > pre.clientHeight) pre.scrollTop = first.offsetTop - 40;
  };
  focus.find = (...needles) => nums.filter(([, t]) => needles.some(nd => t.includes(nd))).map(([n]) => n);
  focus.range = (a, b) => nums.filter(([n]) => n >= a && n <= b).map(([n]) => n);
  return focus;
}
const panes = {};
document.querySelectorAll(".code[data-src]").forEach(h => { panes[h.dataset.src] = codePane(h, h.dataset.src); });

/* ================================================================ hero */
const PKGS = [
  { f: "common", kb: 257, n: 22, m: "tool", d: "Shared types used everywhere (Hash, Address, big-number helpers) plus developer tooling: the bridge to the Solidity compiler, NatSpec comments, and a name registrar." },
  { f: "rpc", kb: 217, n: 46, m: "api", d: "The JSON-RPC API (eth_getBalance, eth_sendTransaction…) that wallets and dapps use to talk to a node." },
  { f: "jsre", kb: 211, n: 4, m: "api", d: "The JavaScript console you get with `geth attach`. Most of its size is web3.js and bignumber.js embedded as Go strings." },
  { f: "eth", kb: 145, n: 13, m: "proto", d: "The Ethereum wire protocol: syncing the chain from peers, announcing and fetching new blocks and transactions." },
  { f: "p2p", kb: 138, n: 15, m: "proto", d: "devp2p: peer discovery with a Kademlia-style table, and the RLPx encrypted transport every connection runs over." },
  { f: "crypto", kb: 131, n: 16, m: "crypt", d: "secp256k1 signatures, Keccak-256 (named sha3 in the code), key files and their passphrase encryption, ECIES." },
  { f: "core", kb: 107, n: 20, m: "chain", d: "The chain: importing and validating blocks, the transaction pool, applying a transaction to the state (state_transition.go), block rewards, genesis. Chapters 4, 8 and 9." },
  { f: "cmd", kb: 101, n: 14, m: "cli", d: "The `geth` program itself (flags, console, account commands) and small tools such as the standalone `evm` runner and a bootnode." },
  { f: "core/vm", kb: 71, n: 17, m: "vm", d: "The Ethereum Virtual Machine: the interpreter loop, the gas table, memory, the 1,024-item stack, precompiled contracts and an experimental JIT. Chapter 5." },
  { f: "logger", kb: 63, n: 8, m: "cli", d: "Logging, including glog-style verbosity levels." },
  { f: "tests", kb: 50, n: 7, m: "tool", d: "Runners for the shared JSON consensus tests that every Ethereum client must pass." },
  { f: "rlp", kb: 49, n: 4, m: "state", d: "Recursive Length Prefix: the one serialisation format for blocks, transactions, accounts and trie nodes. Chapter 3." },
  { f: "xeth", kb: 45, n: 7, m: "api", d: "A front-end bridge that the RPC server and console call into." },
  { f: "whisper", kb: 40, n: 8, m: "proto", d: "Whisper, an experimental private messaging protocol between nodes." },
  { f: "miner", kb: 28, n: 4, m: "chain", d: "Assembles candidate blocks from the transaction pool and hands them to the Ethash proof-of-work." },
  { f: "trie", kb: 28, n: 11, m: "state", d: "The Merkle-Patricia trie behind every root hash in a block header. Chapter 6." },
  { f: "core/state", kb: 28, n: 6, m: "state", d: "The world state: StateObject (one account) and StateDB (all of them), with balances, nonces, code and storage. Chapter 2." },
  { f: "core/types", kb: 27, n: 6, m: "chain", d: "Block, Header, Transaction, Receipt, and the 2,048-bit log bloom filter. Chapters 3 and 7." },
  { f: "accounts", kb: 21, n: 5, m: "crypt", d: "The account manager: unlocking keys and signing transactions." },
  { f: "event", kb: 11, n: 4, m: "cli", d: "An internal publish/subscribe bus (new block, new transaction…)." },
  { f: "ethdb", kb: 11, n: 2, m: "state", d: "The LevelDB database wrapper everything is stored in." },
  { f: "build", kb: 9, n: 1, m: "cli", d: "Build helpers." },
  { f: "metrics", kb: 9, n: 4, m: "cli", d: "Performance counters." },
  { f: "pow", kb: 9, n: 4, m: "chain", d: "Proof-of-work interfaces. Ethash itself, the memory-hard algorithm, is a vendored C library not counted here." },
  { f: "params", kb: 5, n: 1, m: "chain", d: "Every protocol constant in one file: gas costs, the 13-second duration limit, gas-limit bounds. Chapters 4 and 8." },
  { f: "errs", kb: 3, n: 1, m: "cli", d: "Error helpers." },
  { f: "compression", kb: 3, n: 1, m: "cli", d: "Run-length compression helpers." },
  { f: "generators", kb: 2, n: 1, m: "tool", d: "A code generator for the default genesis." },
];
const MODS = {
  chain: { lb: "Chain & blocks", c: "--m-chain" }, vm: { lb: "EVM", c: "--m-vm" }, state: { lb: "State, trie & RLP", c: "--m-state" },
  proto: { lb: "Networking", c: "--m-proto" }, crypt: { lb: "Crypto & keys", c: "--m-crypt" }, api: { lb: "APIs & console", c: "--m-api" },
  tool: { lb: "Tooling & tests", c: "--m-tool" }, cli: { lb: "CLI & plumbing", c: "--m-cli" },
};
const TOTAL = PKGS.reduce((s, f) => s + f.kb, 0);
$("stKB").textContent = fmt(TOTAL) + " KB";
$("stFiles").textContent = `${PKGS.reduce((s, f) => s + f.n, 0)} files in ${PKGS.length} packages`;

const GEN = {
  hash: "d4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3",
  fields: [
    ["ParentHash", z(32), "--m-cli", "No parent: this is block 0."],
    ["UncleHash", "UNCLES", "--m-tool", "keccak256(rlp([])), the hash of an empty uncle list, computed just now."],
    ["Coinbase", z(20), "--m-cli", "Nobody mined block 0."],
    ["Root", unhex("d7f8974fb5ac78d9ac099b9ad5018bedc2ce0a72dad1827a1709da30580f0544"), "--m-state", "The state root: commits to every balance from the 2014 ether presale, the coins that existed at launch."],
    ["TxHash", "EMPTY", "--m-proto", "Root of an empty transaction trie, computed just now."],
    ["ReceiptHash", "EMPTY", "--m-proto", "Root of an empty receipt trie."],
    ["Bloom", z(256), "--m-api", "A 2,048-bit filter of the logs in the block. Empty."],
    ["Difficulty", bigBytes(17179869184n), "--m-chain", "17,179,869,184 = 2³⁴."],
    ["Number", bigBytes(0), "--m-chain", "0. RLP encodes zero as an empty string."],
    ["GasLimit", bigBytes(5000), "--m-vm", "5,000. Too small for one transaction (see note)."],
    ["GasUsed", bigBytes(0), "--m-vm", "0."],
    ["Time", bigBytes(0), "--m-cli", "0, i.e. 1 January 1970."],
    ["Extra", unhex("11bbe8db4e347b4e8c937c1c8370e4b5ed33adb3db69cbdb7a38e1e50b1b82fa"), "--m-crypt", "32 bytes chosen at launch, so nobody could have prepared this exact chain in advance."],
    ["MixDigest", z(32), "--m-crypt", "Ethash's proof that the nonce is valid. Not needed for block 0."],
    ["Nonce", unhex("0000000000000042"), "--m-crypt", "0x42."],
  ],
};
GEN.fields.forEach(f => { if (f[1] === "UNCLES") f[1] = keccak256(rlp([])); if (f[1] === "EMPTY") f[1] = keccak256(rlp(z(0))); });
const genHash = () => hex(keccak256(rlp(GEN.fields.map(f => f[1]))));
(function () {
  const h = genHash();
  $("stGen").textContent = h;
  $("stGenS").innerHTML = h === GEN.hash ? "<b>✓</b> matches Ethereum mainnet block 0" : "mismatch";
})();

(function rain() {
  const cv = $("rain"), g = cv.getContext("2d");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let cols = [], w = 0, h = 0, vis = true;
  const size = () => {
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    w = r.width; h = r.height; cv.width = w * dpr; cv.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Array.from({ length: Math.ceil(w / 18) }, () => ({ y: Math.random() * h, v: .4 + Math.random() * 1.1 }));
  };
  size(); window.addEventListener("resize", size);
  new IntersectionObserver(es => { vis = es[0].isIntersecting; }).observe(cv);
  const H = "0123456789abcdef";
  const tick = () => {
    requestAnimationFrame(tick);
    if (!vis) return;
    g.fillStyle = "rgba(11,12,20,.16)"; g.fillRect(0, 0, w, h);
    g.font = "13px JetBrains Mono, monospace";
    cols.forEach((c, i) => {
      g.fillStyle = Math.random() < .02 ? "rgba(199,210,254,.9)" : "rgba(141,156,244,.35)";
      g.fillText(H[(Math.random() * 16) | 0], i * 18 + 4, c.y);
      c.y += c.v * 6; if (c.y > h + 20) { c.y = -10; c.v = .4 + Math.random() * 1.1; }
    });
  };
  tick();
})();

/* ================================================================ 1. treemap */
function squarify(items, x, y, w, h) {
  const out = [], total = items.reduce((s, i) => s + i.v, 0);
  let rest = items.map(i => ({ ...i, a: i.v * w * h / total }));
  while (rest.length) {
    const sh = Math.min(w, h);
    const worst = r => { const s = r.reduce((t, i) => t + i.a, 0), mx = Math.max(...r.map(i => i.a)), mn = Math.min(...r.map(i => i.a)); return Math.max(sh * sh * mx / (s * s), s * s / (sh * sh * mn)); };
    const row = [rest[0]]; let k = 1;
    while (k < rest.length && worst([...row, rest[k]]) <= worst(row)) row.push(rest[k++]);
    const s = row.reduce((t, i) => t + i.a, 0);
    if (w >= h) { const cw = s / h; let cy = y; for (const i of row) { const ch = i.a / cw; out.push({ i, x, y: cy, w: cw, h: ch }); cy += ch; } x += cw; w -= cw; }
    else { const ch = s / w; let cx = x; for (const i of row) { const cw = i.a / ch; out.push({ i, x: cx, y, w: cw, h: ch }); cx += cw; } y += ch; h -= ch; }
    rest = rest.slice(k);
  }
  return out;
}
let tmSel = "core/vm";
function drawTreemap() {
  const host = $("treemap"), W = host.clientWidth, Hh = host.clientHeight;
  const groups = Object.keys(MODS).map(m => ({ m, v: PKGS.filter(f => f.m === m).reduce((s, f) => s + f.kb, 0) })).sort((a, b) => b.v - a.v);
  let html = "";
  for (const gr of squarify(groups, 0, 0, W, Hh)) {
    const files = PKGS.filter(f => f.m === gr.i.m).map(f => ({ ...f, v: f.kb })).sort((a, b) => b.v - a.v);
    for (const r of squarify(files, gr.x, gr.y, gr.w, gr.h)) {
      const f = r.i, big = r.w > 64 && r.h > 34;
      html += `<button type="button" class="tm${f.m === "api" ? " gui" : ""}" data-f="${f.f}" aria-pressed="${f.f === tmSel}" title="${f.f} · ${f.kb} KB"
        style="--c:${css(MODS[f.m].c)};left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px">${big ? `<div class="f">${f.f}</div><div class="n">${f.kb} KB</div>` : ""}</button>`;
    }
  }
  host.innerHTML = html;
  $("tmLegend").innerHTML = Object.values(MODS).map(m => `<span><i class="sw" style="--c:${css(m.c)}"></i>${m.lb}</span>`).join("");
}
function fileInfo(name) {
  tmSel = name;
  const f = PKGS.find(x => x.f === name), M = MODS[f.m];
  document.querySelectorAll(".tm").forEach(b => b.setAttribute("aria-pressed", b.dataset.f === name));
  const modKB = PKGS.filter(x => x.m === f.m).reduce((s, x) => s + x.kb, 0);
  $("fileinfo").innerHTML = `<span class="tag" style="--c:${css(M.c)}"><i class="sw" style="--c:${css(M.c)}"></i>${M.lb}</span>
    <h3>${f.f}/</h3><div class="lines">${f.kb} KB in ${f.n} file${f.n > 1 ? "s" : ""} · ${(f.kb / TOTAL * 100).toFixed(1)}% of the client</div>
    <p>${esc(f.d).replace(/`([^`]+)`/g, "<code>$1</code>")}</p>
    <div class="bar100"><span style="width:${modKB / TOTAL * 100}%;--c:${css(M.c)}"></span></div>
    <p class="hint" style="margin-top:6px">${M.lb}: ${fmt(modKB)} KB, ${(modKB / TOTAL * 100).toFixed(0)}% of the total</p>
    <p class="hint" style="margin-top:14px"><a href="https://github.com/ethereum/go-ethereum/tree/v1.0.0/${f.f}" target="_blank" rel="noopener">Browse ${f.f}/ on GitHub ↗</a></p>`;
}
$("treemap").addEventListener("click", e => { const b = e.target.closest(".tm"); if (b) fileInfo(b.dataset.f); });
$("treemap").addEventListener("mouseover", e => { const b = e.target.closest(".tm"); if (b) fileInfo(b.dataset.f); });

/* ================================================================ 5 (first: other chapters use it). a small EVM */
const OPS = { 0x00: "STOP", 0x01: "ADD", 0x03: "SUB", 0x10: "LT", 0x11: "GT", 0x14: "EQ", 0x15: "ISZERO", 0x50: "POP", 0x51: "MLOAD", 0x52: "MSTORE",
  0x54: "SLOAD", 0x55: "SSTORE", 0x56: "JUMP", 0x57: "JUMPI", 0x58: "PC", 0x5a: "GAS", 0x5b: "JUMPDEST", 0xf3: "RETURN" };
for (let i = 0; i < 32; i++) OPS[0x60 + i] = "PUSH" + (i + 1);
for (let i = 0; i < 16; i++) { OPS[0x80 + i] = "DUP" + (i + 1); OPS[0x90 + i] = "SWAP" + (i + 1); }
const BASE = { STOP: 0, ADD: 3, SUB: 3, LT: 3, GT: 3, EQ: 3, ISZERO: 3, POP: 2, MLOAD: 3, MSTORE: 3, SLOAD: 50, SSTORE: 0, JUMP: 8, JUMPI: 10, PC: 2, GAS: 2, JUMPDEST: 1, RETURN: 0 };
const POPS = { ADD: 2, SUB: 2, LT: 2, GT: 2, EQ: 2, ISZERO: 1, POP: 1, MLOAD: 1, MSTORE: 2, SLOAD: 1, SSTORE: 2, JUMP: 1, JUMPI: 2, RETURN: 2 };
const M256 = (1n << 256n) - 1n;
const memFee = words => words * 3n + words * words / 512n;
function disasm(code) {
  const out = [];
  for (let pc = 0; pc < code.length; pc++) {
    const op = code[pc], nm = OPS[op] || `INVALID(0x${op.toString(16)})`;
    if (op >= 0x60 && op <= 0x7f) { const n = op - 0x5f; out.push({ pc, op, nm, arg: hex(code.slice(pc + 1, pc + 1 + n)), len: n + 1 }); pc += n; }
    else out.push({ pc, op, nm, len: 1 });
  }
  return out;
}
function evm(code, gasLimit, storage) {
  const ins = disasm(code), dests = new Set(ins.filter(i => i.op === 0x5b).map(i => i.pc));
  let pc = 0, gas = BigInt(gasLimit), refund = 0n, mem = new Uint8Array(0);
  const stack = [], sto = new Map(storage), steps = [];
  const snap = (o) => steps.push({ ...o, gas, stack: stack.slice(), mem: mem.slice(), sto: new Map(sto), refund });
  snap({ pc: 0, start: true, say: `Start with <b>${fmt(gasLimit)}</b> gas, an empty stack and empty memory. Press Step.` });
  const word = v => { const b = z(32); let h = v.toString(16).padStart(64, "0"); for (let i = 0; i < 32; i++) b[i] = parseInt(h.substr(i * 2, 2), 16); return b; };
  const expand = (off, size) => { if (size === 0n) return 0n; const need = (off + size + 31n) / 32n, cur = BigInt(mem.length / 32); return need > cur ? memFee(need) - memFee(cur) : 0n; };
  for (let guard = 0; guard < 2000; guard++) {
    const op = pc < code.length ? code[pc] : 0, nm = OPS[op];
    if (!nm) { snap({ pc, nm: "INVALID", err: `Opcode 0x${op.toString(16)} isn't supported in this demo. (geth would run it, or fail with “Invalid opcode”.)` }); break; }
    const need = POPS[nm] ?? (nm.startsWith("DUP") ? +nm.slice(3) : nm.startsWith("SWAP") ? +nm.slice(4) + 1 : 0);
    if (stack.length < need) { snap({ pc, nm, err: `Stack underflow: ${nm} needs ${need} item${need > 1 ? "s" : ""}. The call fails.` }); break; }
    // gas, as calculateGasAndSize does it: base price, then the special cases, then memory expansion
    let cost = BigInt(BASE[nm] ?? 3), gasKind = "table", mx = 0n, sKind = null;
    if (nm === "SSTORE") {
      const loc = stack[stack.length - 1], val = stack[stack.length - 2], cur = sto.get(loc) || 0n;
      if (cur === 0n && val !== 0n) { cost = 20000n; sKind = "set"; } else if (cur !== 0n && val === 0n) { cost = 5000n; sKind = "clear"; } else { cost = 5000n; sKind = "reset"; }
      gasKind = "sstore";
    }
    if (nm === "MLOAD") mx = expand(stack[stack.length - 1], 32n);
    if (nm === "MSTORE") mx = expand(stack[stack.length - 1], 32n);
    if (nm === "RETURN") mx = expand(stack[stack.length - 1], stack[stack.length - 2]);
    if (mx > 0n) gasKind = "mem";
    cost += mx;
    if (gas < cost) { const had = gas; gas = 0n; snap({ pc, nm, cost, gasKind, sKind, oog: true, err: `<b>Out of gas.</b> ${nm} costs ${fmt(cost)} but only ${fmt(had)} is left. The VM burns everything that's left and throws away every change this call made.` }); break; }
    gas -= cost;
    const pop = () => stack.pop(), push = v => stack.push(v & M256);
    let say = "", ret = null, done = false, jumped = false;
    const ins1 = ins.find(i => i.pc === pc);
    switch (nm) {
      case "STOP": say = "<b>STOP</b>: halt. Storage changes are kept."; done = true; break;
      case "ADD": { const x = pop(), y = pop(); push(x + y); say = `<b>ADD</b> pops ${x} and ${y} and pushes ${(x + y) & M256}. Arithmetic wraps at 2²⁵⁶.`; break; }
      case "SUB": { const x = pop(), y = pop(); push(x - y + (1n << 256n)); say = `<b>SUB</b> pops ${x} then ${y} and pushes ${x} − ${y} = ${(x - y + (1n << 256n)) & M256}.`; break; }
      case "LT": { const x = pop(), y = pop(); push(x < y ? 1n : 0n); say = `<b>LT</b>: is ${x} &lt; ${y}? Pushes ${x < y ? 1 : 0}.`; break; }
      case "GT": { const x = pop(), y = pop(); push(x > y ? 1n : 0n); say = `<b>GT</b>: is ${x} &gt; ${y}? Pushes ${x > y ? 1 : 0}.`; break; }
      case "EQ": { const x = pop(), y = pop(); push(x === y ? 1n : 0n); say = `<b>EQ</b>: ${x} == ${y}? Pushes ${x === y ? 1 : 0}.`; break; }
      case "ISZERO": { const x = pop(); push(x === 0n ? 1n : 0n); say = `<b>ISZERO</b>: pushes ${x === 0n ? 1 : 0}.`; break; }
      case "POP": pop(); say = "<b>POP</b> throws the top item away."; break;
      case "MLOAD": { const off = pop(); if (mx) mem = (() => { const m = z(Number((off + 32n + 31n) / 32n) * 32); m.set(mem); return m; })(); const v = BigInt("0x" + (hex(mem.slice(Number(off), Number(off) + 32)) || "0")); push(v); say = `<b>MLOAD</b> reads 32 bytes of memory at offset ${off}.`; break; }
      case "MSTORE": { const off = pop(), v = pop(); const need = Number((off + 32n + 31n) / 32n) * 32; if (need > mem.length) { const m = z(need); m.set(mem); mem = m; } mem.set(word(v), Number(off)); say = `<b>MSTORE</b> writes ${v} as a 32-byte word at memory offset ${off}.` + (mx ? ` Memory grew, costing <b>${mx}</b> extra gas (3 per word plus words²/512).` : ""); break; }
      case "SLOAD": { const k = pop(), v = sto.get(k) || 0n; push(v); say = `<b>SLOAD</b> reads storage slot ${k}: ${v}. Storage lives in the contract's account, so this costs 50 gas, far more than memory.`; break; }
      case "SSTORE": { const k = pop(), v = pop(); const was = sto.get(k) || 0n; if (v === 0n) sto.delete(k); else sto.set(k, v); if (sKind === "clear") refund += 15000n;
        say = `<b>SSTORE</b> writes ${v} to slot ${k} (was ${was}). ` + (sKind === "set" ? "Zero → non-zero creates a new entry in the state: <b>20,000 gas</b>, the most expensive common step." : sKind === "clear" ? "Non-zero → zero frees space: 5,000 gas, and <b>15,000 is refunded</b> at the end." : "The slot already held a value, so it's a change: <b>5,000 gas</b>."); break; }
      case "JUMP": { const d = pop(); if (!dests.has(Number(d))) { snap({ pc, nm, cost, gasKind, err: `JUMP to ${d}, which isn't a JUMPDEST. The call fails.` }); return steps; } say = `<b>JUMP</b> to ${d}.`; pc = Number(d); jumped = true; break; }
      case "JUMPI": { const d = pop(), c = pop(); if (c !== 0n) { if (!dests.has(Number(d))) { snap({ pc, nm, cost, gasKind, err: `JUMPI to ${d}, which isn't a JUMPDEST.` }); return steps; } say = `<b>JUMPI</b>: condition ${c} ≠ 0, so jump to ${d}.`; pc = Number(d); jumped = true; } else say = `<b>JUMPI</b>: condition is 0, so carry on to the next instruction.`; break; }
      case "JUMPDEST": say = "<b>JUMPDEST</b> marks a legal jump target. It does nothing else (1 gas)."; break;
      case "PC": push(BigInt(pc)); say = `<b>PC</b> pushes the program counter, ${pc}.`; break;
      case "GAS": push(gas); say = `<b>GAS</b> pushes the gas left after paying for this instruction.`; break;
      case "RETURN": { const off = pop(), size = pop(); const need = Number((off + size + 31n) / 32n) * 32; if (size && need > mem.length) { const m = z(need); m.set(mem); mem = m; } ret = mem.slice(Number(off), Number(off + size)); say = `<b>RETURN</b> ends the call and hands back ${size} bytes of memory: <span class="mono">0x${hex(ret).replace(/^(00)+/, "") || "0"}</span>.`; done = true; break; }
      default:
        if (nm.startsWith("PUSH")) { const v = BigInt("0x" + ins1.arg); push(v); say = `<b>${nm}</b> pushes the next ${ins1.len - 1} byte${ins1.len > 2 ? "s" : ""} of code, 0x${ins1.arg} = ${v}. The program counter skips over them.`; }
        else if (nm.startsWith("DUP")) { const n = +nm.slice(3); push(stack[stack.length - n]); say = `<b>${nm}</b> copies item ${n} from the top.`; }
        else if (nm.startsWith("SWAP")) { const n = +nm.slice(4); const t = stack[stack.length - 1]; stack[stack.length - 1] = stack[stack.length - 1 - n]; stack[stack.length - 1 - n] = t; say = `<b>${nm}</b> swaps the top item with item ${n + 1}.`; }
    }
    snap({ pc, nm, cost, gasKind, sKind, mx, say, done, ret });
    if (done) break;
    if (!jumped) pc += ins1 ? ins1.len : 1;
  }
  return steps;
}

/* ================================================================ 2. accounts */
const addrOf = name => keccak256(utf8(name)).slice(12);
const COUNTER = unhex("60005460010160005500");
const EMPTY_CODE = keccak256(z(0)), EMPTY_ROOT = keccak256(rlp(z(0)));
function storageRoot(sto) {
  let t = null;
  for (const [k, v] of sto) if (v !== 0n) t = trieInsert(t, nibbles(keccak256(unhex(k.toString(16).padStart(64, "0")))), rlp(bigBytes(v)));
  return t ? trieRoot(t) : EMPTY_ROOT;
}
const GASPRICE = 50n * GWEI;
let W;
function worldReset() {
  W = {
    accts: [
      { nm: "Alice", kind: "account", c: "--m-proto", nonce: 0, bal: 10n * WEI },
      { nm: "Bob", kind: "account", c: "--m-proto", nonce: 0, bal: 2n * WEI },
      { nm: "Counter", kind: "contract", c: "--m-vm", nonce: 0, bal: 0n, code: COUNTER, sto: new Map() },
      { nm: "Miner", kind: "coinbase", c: "--m-chain", nonce: 0, bal: 0n },
    ],
    log: [], changed: new Set(),
  };
  W.accts.forEach(a => { a.addr = addrOf(a.nm); });
  drawAccounts();
}
const acct = nm => W.accts.find(a => a.nm === nm);
const acctRlp = a => rlp([bigBytes(a.nonce), bigBytes(a.bal), a.sto ? storageRoot(a.sto) : EMPTY_ROOT, a.code ? keccak256(a.code) : EMPTY_CODE]);
function stateRoot() { let t = null; for (const a of W.accts) t = trieInsert(t, nibbles(keccak256(a.addr)), acctRlp(a)); return hex(trieRoot(t)); }
function drawAccounts() {
  $("accts").innerHTML = W.accts.map(a => {
    const ch = f => W.changed.has(a.nm + f) ? " chg" : "";
    return `<div class="acct${W.changed.size && [...W.changed].some(x => x.startsWith(a.nm)) ? " flash" : ""}" style="--c:${css(a.c)}">
      <div class="top"><span class="nm">${a.nm}</span><span class="kind">${a.kind}</span></div>
      <div class="ad">0x${short(hex(a.addr))}</div>
      <dl><dt>nonce</dt><dd class="${ch("n")}">${a.nonce}</dd>
      <dt>balance</dt><dd class="${ch("b")}">${eth(a.bal)} ETH</dd>
      <dt>storageRoot</dt><dd class="h${ch("s")}">${a.sto ? short(hex(storageRoot(a.sto))) : "empty"}</dd>
      <dt>codeHash</dt><dd class="h">${a.code ? short(hex(keccak256(a.code))) : "no code"}</dd>
      ${a.sto ? `<dt>slot 0</dt><dd class="${ch("s")}">${a.sto.get(0n) || 0n}</dd>` : ""}</dl></div>`;
  }).join("");
  $("sRoot").textContent = "0x" + stateRoot();
  $("txlog").innerHTML = W.log.slice(0, 4).map((l, i) => `<div style="opacity:${i ? .55 : 1}">${l}</div>`).join("");
  setTimeout(() => document.querySelectorAll(".acct.flash").forEach(e => e.classList.remove("flash")), 700);
}
function applyTx(to, value, execGas, after) {
  const A = acct("Alice"), used = 21000n + execGas, fee = used * GASPRICE;
  A.nonce++; A.bal -= value + fee; acct(to).bal += value; acct("Miner").bal += fee;
  W.changed = new Set(["Alicen", "Aliceb", to + "b", "Minerb"]);
  after && after();
  return { used, fee };
}
$("txSend").onclick = () => {
  const { fee } = applyTx("Bob", WEI, 0n);
  W.log.unshift(`nonce ${acct("Alice").nonce - 1}: Alice → Bob 1 ETH · gas 21,000 × 50 gwei = ${eth(fee)} ETH to the miner`);
  drawAccounts();
};
$("txCall").onclick = () => {
  const C = acct("Counter"), steps = evm(C.code, 100000, C.sto), end = steps[steps.length - 1];
  const exec = 100000n - end.gas;
  const { fee, used } = applyTx("Counter", 0n, exec, () => { C.sto = end.sto; W.changed.add("Counters"); });
  W.log.unshift(`nonce ${acct("Alice").nonce - 1}: Alice → Counter · EVM ran ${steps.length - 1} steps, gas ${fmt(used)} (21,000 + ${fmt(exec)}) = ${eth(fee)} ETH · slot 0 = ${C.sto.get(0n)}`);
  drawAccounts();
};
$("txReset").onclick = worldReset;
panes["src-stateobj"](panes["src-stateobj"].find("balance *big.Int", "nonce uint64", "codeHash []byte", "trie *trie.SecureTrie", "common.Encode([]interface{}{c.nonce"));

/* ================================================================ 3. transaction + RLP */
const TXF = [
  { k: "nonce", lb: "AccountNonce", c: "--m-crypt", v: "0", enc: v => bigBytes(BigInt(v || 0)), say: "How many transactions the sender has sent before. Stops replays." },
  { k: "price", lb: "Price (gwei)", c: "--m-chain", v: "50", enc: v => bigBytes(BigInt(Math.round(+v * 1e9 || 0))), say: "Wei paid per unit of gas. Written in wei, so 50 gwei is 50,000,000,000." },
  { k: "gas", lb: "GasLimit", c: "--m-tool", v: "90000", enc: v => bigBytes(BigInt(v || 0)), say: "The most gas the sender will pay for. Unused gas is refunded." },
  { k: "to", lb: "Recipient", c: "--m-proto", v: "0x" + hex(addrOf("Bob")), enc: v => { const h = v.replace(/^0x/, "").replace(/[^0-9a-f]/gi, ""); return h ? unhex(h.padStart(40, "0").slice(-40)) : z(0); }, say: "20-byte address. Leave it empty to create a contract: then the payload is the contract's init code." },
  { k: "amount", lb: "Amount (ETH)", c: "--m-state", v: "1", enc: v => bigBytes(parseEth(v) ?? 0n), say: "Ether to send, in wei. 1 ETH is 10¹⁸ wei." },
  { k: "data", lb: "Payload (hex)", c: "--m-vm", v: "0x", enc: v => unhex(v.replace(/^0x/, "").replace(/[^0-9a-f]/gi, "")), say: "Call data for a contract, or init code for a new one. Each non-zero byte costs 68 gas, each zero byte 4.", wide: true },
];
const TXS = Object.fromEntries(TXF.map(f => [f.k, f.v]));
$("txform").innerHTML = TXF.map(f => `<label class="${f.wide ? "wide" : ""}" style="--c:${css(f.c)}"><span><i></i>${f.lb}</span><input data-k="${f.k}" value="${f.v}" spellcheck="false" autocomplete="off"></label>`).join("");
$("txform").addEventListener("input", e => { const i = e.target.closest("input"); if (i) { TXS[i.dataset.k] = i.value; drawTx(); drawGas(); } });
let rlpSel = null;
function drawTx() {
  const items = TXF.map(f => f.enc(TXS[f.k])), enc = rlp(items);
  const hdrLen = enc.length - items.reduce((s, it) => s + rlp(it).length, 0);
  let html = "", shown = 0;
  const add = (bytes, c, k, pfxN) => {
    bytes.forEach((b, i) => {
      if (shown > 220) return;
      html += `<span data-k="${k}" class="${i < pfxN ? "pfx" : ""}${rlpSel && rlpSel !== k ? " dim" : ""}" style="--c:${css(c)}">${b.toString(16).padStart(2, "0")}</span>`; shown++;
    });
  };
  add(enc.slice(0, hdrLen), "--muted", "list", hdrLen);
  TXF.forEach((f, i) => { const r = rlp(items[i]); add(r, f.c, f.k, r.length - items[i].length); });
  if (enc.length > 221) html += `<span class="more">… +${enc.length - 221} bytes</span>`;
  $("rlpbytes").innerHTML = html;
  $("rlpLen").textContent = `${enc.length} bytes`;
  const k = rlpSel, f = TXF.find(x => x.k === k);
  if (k === "list") $("rlpnote").innerHTML = `<b>List header</b> 0x${hex(enc.slice(0, hdrLen))}: ${enc.length - hdrLen < 56 ? `0xc0 + ${enc.length - hdrLen}, a list whose items take ${enc.length - hdrLen} bytes` : `0xf7 + ${hdrLen - 1}, then the length ${enc.length - hdrLen} in ${hdrLen - 1} byte(s), for lists of 56 bytes or more`}.`;
  else if (f) { const it = items[TXF.indexOf(f)], r = rlp(it); $("rlpnote").innerHTML = `<b>${f.lb}</b>: ${f.say} ` + (it.length === 1 && it[0] < 0x80 ? `A single byte under 0x80 is its own encoding.` : r.length - it.length === 1 ? `Prefix 0x${r[0].toString(16)} = 0x80 + ${it.length} bytes.` : `Prefix 0x${hex(r.slice(0, r.length - it.length))}: 0xb7 + length-of-length, then the length.`); }
  else $("rlpnote").innerHTML = "Hover the bytes. Darker cells are RLP's length prefixes, the lighter ones are the data. <b>Zero is an empty string</b> (0x80), so leading zeros are never stored.";
  $("sigHash").textContent = "0x" + hex(keccak256(enc));
  const F = panes["src-txdata"]; F(f ? F.find({ nonce: "AccountNonce", price: "Price, GasLimit", gas: "Price, GasLimit", to: "Recipient", amount: "Amount", data: "Payload" }[k]) : []);
}
const rlpHover = e => { const t = e.target.closest("[data-k]"); const k = t ? t.dataset.k : null; if (k !== rlpSel) { rlpSel = k; drawTx(); } };
$("rlpbytes").addEventListener("mouseover", rlpHover);
$("rlpbytes").addEventListener("mouseleave", () => { rlpSel = null; drawTx(); });

/* ================================================================ 4. gas */
const EV = { lastExec: 0n, lastRefund: 0n, lastName: "nothing yet" };
function drawGas() {
  const data = TXF[5].enc(TXS.data), nz = data.filter(b => b).length, zz = data.length - nz;
  const intr = 21000n + 68n * BigInt(nz) + 4n * BigInt(zz), limit = BigInt(TXS.gas || 0), price = BigInt(Math.round(+TXS.price * 1e9 || 0));
  const exec = EV.lastExec, used0 = intr + exec, oog = used0 > limit;
  const used = oog ? limit : used0, refund = oog ? 0n : (EV.lastRefund < used / 2n ? EV.lastRefund : used / 2n);
  const unused = limit - used, paid = used - refund, L = Number(limit) || 1;
  const seg = (lb, v, c) => v > 0n ? `<div style="--c:${css(c)};flex:${Number(v) / L} 1 0" title="${lb}: ${fmt(v)}">${lb}<small>${fmt(v)}</small></div>` : "";
  $("gasbar").innerHTML = oog ? seg("out of gas: all burned", limit, "--down") : seg("intrinsic", intr, "--m-tool") + seg("execution", exec, "--m-vm") + seg("unused → refunded", unused, "--rule-strong");
  $("flow4").innerHTML = [["pre-paid", limit * price, `${fmt(limit)} gas`], ["used", used * price, `${fmt(used)} gas`], ["back to sender", (unused + refund) * price, `${fmt(unused + refund)} gas`], ["to the miner", paid * price, `${fmt(paid)} gas`]]
    .map(([k, w, s]) => `<div class="kv"><div class="k">${k}</div><div class="v">${eth(w, 6)} ETH</div><div class="hint">${s}</div></div>`).join("");
  $("gasNote").innerHTML = `Intrinsic gas = 21,000 + 68 × ${nz} non-zero + 4 × ${zz} zero data bytes = <b>${fmt(intr)}</b>. Execution: <b>${fmt(exec)}</b> from the EVM program “${EV.lastName}”.` +
    (refund ? ` Clearing storage earned a refund of ${fmt(refund)} (capped at half the gas used).` : "") +
    (oog ? ` <span class="bad">The gas limit (${fmt(limit)}) is too low: the transaction runs out, every change is undone, and the sender still pays for all of it.</span>` : "");
  const F = panes["src-intrinsic"]; F(nz || zz ? F.range(80, 96) : F.find("igas := new(big.Int).Set(params.TxGas)", "return igas"));
}

/* ================================================================ 5. EVM ui */
const PROGS = [
  { k: "add", lb: "2 + 3 → storage", hex: "600360020160005500", gas: 100000, why: "Adds two numbers and saves the result in storage slot 0." },
  { k: "counter", lb: "Counter", hex: "60005460010160005500", gas: 100000, why: "Reads slot 0, adds 1, writes it back: the Counter contract from chapter 2. Run it twice: the first write costs 20,000, later ones 5,000." },
  { k: "loop", lb: "Loop", hex: "60055b600190038060025700", gas: 100000, why: "Counts down from 5 with JUMPI. Every pass costs gas, which is why an infinite loop just runs out." },
  { k: "mem", lb: "Memory & RETURN", hex: "602a60005260206000f3", gas: 100000, why: "Writes 42 into memory and returns it, as a function returns a value." },
  { k: "oog", lb: "Out of gas", hex: "60005460010160005500", gas: 20050, why: "The Counter again, with only 20,050 gas: not enough for a 20,000-gas SSTORE after the earlier steps." },
  { k: "custom", lb: "Your bytecode", hex: "6001600101", gas: 50000, why: "Type any bytecode in hex. Supported: arithmetic, comparisons, PUSH/DUP/SWAP/POP, MLOAD/MSTORE, SLOAD/SSTORE, JUMP/JUMPI, PC, GAS, RETURN, STOP." },
];
const OPSRC = {
  ADD: ["src-op-arith", 144, 152], SUB: ["src-op-arith", 153, 161], LT: ["src-op-cmp", 260, 268], GT: ["src-op-cmp", 269, 277], EQ: ["src-op-eq", 298, 306], ISZERO: ["src-op-eq", 307, 313],
  PUSH: ["src-op-push", 480, 485], POP: ["src-op-push", 487, 488], DUP: ["src-op-push", 489, 491], SWAP: ["src-op-push", 493, 495],
  MLOAD: ["src-op-mem", 509, 512], MSTORE: ["src-op-mem", 514, 517], SLOAD: ["src-op-sto", 524, 527], SSTORE: ["src-op-sto", 529, 533],
  JUMP: ["src-op-jump", 535, 540], JUMPI: ["src-op-jump", 541, 551], JUMPDEST: ["src-op-jump", 552, 552], PC: ["src-op-jump", 553, 554], GAS: ["src-op-jump", 557, 558],
  RETURN: ["src-op-ret", 626, 630], STOP: ["src-op-ret", 640, 642],
};
const E = { prog: PROGS[1], steps: [], k: 0, sto: new Map(), committed: false, timer: null, opPane: null, opSrc: null, gasPane: null, gasSrc: null };
$("progSeg").innerHTML = PROGS.map(p => `<button type="button" data-k="${p.k}">${p.lb}</button>`).join("");
$("progSeg").onclick = e => { const b = e.target.closest("button"); if (b) { E.prog = PROGS.find(p => p.k === b.dataset.k); evmLoad(); } };
$("customHex").value = PROGS[5].hex; $("customGas").value = PROGS[5].gas;
$("customHex").addEventListener("input", () => { PROGS[5].hex = $("customHex").value.replace(/^0x/, "").replace(/[^0-9a-f]/gi, ""); evmLoad(); });
$("customGas").addEventListener("input", () => { PROGS[5].gas = Math.max(0, Math.min(1e7, parseInt($("customGas").value) || 0)); evmLoad(); });
function evmLoad() {
  stopRun();
  document.querySelectorAll("#progSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.k === E.prog.k));
  $("customIO").hidden = E.prog.k !== "custom";
  const code = unhex(E.prog.hex.length % 2 ? E.prog.hex + "0" : E.prog.hex);
  E.code = code; E.ins = disasm(code); E.steps = evm(code, E.prog.gas, E.sto); E.k = 0; E.committed = false;
  const fin = E.steps[E.steps.length - 1];   // the gas chapter shows this program's full run straight away
  EV.lastExec = fin.oog ? BigInt(E.prog.gas) : BigInt(E.prog.gas) - fin.gas; EV.lastRefund = fin.refund; EV.lastName = E.prog.lb; drawGas();
  evmRender();
}
const fmtWord = v => v < 1000000n ? `${v}  <span class="hint">0x${v.toString(16)}</span>` : "0x" + v.toString(16);
function evmRender() {
  const s = E.steps[E.k], last = E.k === E.steps.length - 1, cur = s.start ? -1 : s.pc;
  let bc = "";
  E.ins.forEach(i => {
    bc += `<span class="op${i.pc === cur ? " cur" : ""}" title="${i.nm}">${i.op.toString(16).padStart(2, "0")}</span>`;
    if (i.arg) bc += [...i.arg.match(/../g)].map(x => `<span class="arg${i.pc === cur ? " cur" : ""}">${x}</span>`).join("");
  });
  $("bc").innerHTML = bc || `<span class="empty">empty program</span>`;
  $("dis").innerHTML = E.ins.map(i => `<div class="${i.pc === cur ? "cur" : ""}"><b>${i.pc}</b><span>${i.nm}${i.arg ? " 0x" + i.arg : ""}</span><i>${i.nm.startsWith("PUSH") ? 3 : i.nm.startsWith("DUP") || i.nm.startsWith("SWAP") ? 3 : i.nm === "SSTORE" ? "5k/20k" : BASE[i.nm] ?? ""}</i></div>`).join("");
  const cd = $("dis").querySelector(".cur"); if (cd) cd.scrollIntoView({ block: "nearest" });
  $("gasLeft").textContent = `${fmt(s.gas)} of ${fmt(E.prog.gas)}` + (s.cost != null ? ` · this step ${fmt(s.cost)}` : "");
  $("gasMeter").style.width = (Number(s.gas) / Math.max(1, E.prog.gas) * 100) + "%";
  $("stk").innerHTML = s.stack.length ? s.stack.map(v => `<div>${fmtWord(v)}</div>`).join("") : `<span class="empty">empty</span>`;
  const words = []; for (let i = 0; i < s.mem.length; i += 32) words.push(hex(s.mem.slice(i, i + 32)));
  $("mem").innerHTML = words.length ? words.map((w, i) => `<div title="0x${w}">[${i * 32}] 0x…${w.slice(-16)}</div>`).join("") : `<span class="empty">empty</span>`;
  const prev = E.k ? E.steps[E.k - 1].sto : E.sto;
  $("sto").innerHTML = s.sto.size ? [...s.sto].map(([k, v]) => `<div class="${prev.get(k) !== v ? "new" : ""}">slot ${k} = ${v}</div>`).join("") : `<span class="empty">empty</span>`;
  let note = s.err ? `<span class="bad">✗</span> ${s.err}` : s.say;
  if (s.start) note += ` <span class="hint">${E.prog.why}</span>`;
  if (last && !s.err) note += ` <span class="ok">Done: ${fmt(BigInt(E.prog.gas) - s.gas)} gas used.</span>`;
  $("stepnote").innerHTML = note;
  // code: which case of the switch ran, and where its gas came from
  const key = s.nm ? (s.nm.replace(/\d+$/, "") in OPSRC ? s.nm.replace(/\d+$/, "") : s.nm) : null;
  const src = key && OPSRC[key] ? OPSRC[key][0] : "src-loop";
  if (E.opSrc !== src) { E.opSrc = src; E.opPane = codePane($("codeOp"), src); }
  E.opPane(key && OPSRC[key] ? E.opPane.range(OPSRC[key][1], OPSRC[key][2]) : s.oog ? E.opPane.find("if !context.UseGas(cost)", "context.UseGas(context.Gas)", "OutOfGasError") : []);
  const gsrc = s.gasKind === "sstore" ? "src-gas-sstore" : s.gasKind === "mem" ? "src-gas-mem" : "src-gastable";
  if (E.gasSrc !== gsrc) { E.gasSrc = gsrc; E.gasPane = codePane($("codeGas"), gsrc); }
  const G = E.gasPane;
  if (gsrc === "src-gas-sstore") G(s.sKind === "set" ? G.range(711, 713) : s.sKind === "clear" ? G.range(714, 717) : G.range(718, 720));
  else if (gsrc === "src-gas-mem") G(G.range(781, 794));
  else if (key) G(G.find("\t" + (key === "PUSH" ? "PUSH1" : key === "DUP" ? "DUP1" : key) + ":"));
  else G([]);
  $("eBack").disabled = E.k === 0; $("eStep").disabled = last;
  if (last && !E.committed) {
    E.committed = true;
    if (!s.err) E.sto = s.sto;
  }
}
function stopRun() { clearInterval(E.timer); E.timer = null; $("eRun").textContent = "▶ Run"; }
$("eStep").onclick = () => { stopRun(); if (E.k < E.steps.length - 1) { E.k++; evmRender(); } };
$("eBack").onclick = () => { stopRun(); if (E.k > 0) { E.k--; evmRender(); } };
$("eReset").onclick = () => evmLoad();
$("eWipe").onclick = () => { E.sto = new Map(); evmLoad(); };
$("eRun").onclick = () => {
  if (E.timer) return stopRun();
  if (E.k === E.steps.length - 1) evmLoad();
  $("eRun").textContent = "❚❚ Pause";
  E.timer = setInterval(() => { if (E.k >= E.steps.length - 1) return stopRun(); E.k++; evmRender(); }, 650);
};

/* ================================================================ 6. trie */
const CLASSIC = [["do", "verb"], ["dog", "puppy"], ["doge", "coin"], ["horse", "stallion"]];
let KV = CLASSIC.map(x => x.slice());
function drawKV() {
  $("kvs").innerHTML = KV.map(([k, v], i) => `<div class="kvrow"><input data-i="${i}" data-f="0" value="${esc(k)}" aria-label="key"><input data-i="${i}" data-f="1" value="${esc(v)}" aria-label="value"><button type="button" data-del="${i}" aria-label="Remove">✕</button></div>`).join("");
}
$("kvs").addEventListener("input", e => { const t = e.target; if (t.dataset.i != null) { KV[+t.dataset.i][+t.dataset.f] = t.value; drawTrie(); } });
$("kvs").addEventListener("click", e => { const b = e.target.closest("[data-del]"); if (b) { KV.splice(+b.dataset.del, 1); drawKV(); drawTrie(); } });
$("kvAdd").onclick = () => { KV.push(["dot", "period"]); drawKV(); drawTrie(); };
$("kvReset").onclick = () => { KV = CLASSIC.map(x => x.slice()); drawKV(); drawTrie(); };
const NIB = "0123456789abcdef";
function drawTrie() {
  let t = null; const seen = new Map();
  for (const [k, v] of KV) if (k && v) seen.set(k, v);
  for (const [k, v] of seen) t = trieInsert(t, nibbles(utf8(k)), utf8(v));
  const root = hex(trieRoot(t));
  $("trieRoot").textContent = "0x" + root;
  $("trieOk").innerHTML = root === "5991bb8c6514148a29db676a14ac506cd2cd5775ace63c30a4fe457715e9ac84" ? `<span class="ok">✓ the published example root</span>` : "";
  const host = $("trieView");
  if (!t) { host.innerHTML = `<p class="hint">Empty trie: the root is keccak256(rlp("")) = 0x56e81f…</p>`; return; }
  // layout: each node gets horizontal slots equal to its number of leaves
  const NW = 112, NH = 50, GX = 10, GY = 64;
  const kids = n => n.t === "branch" ? n.kids.map((k, i) => k ? [NIB[i], k] : null).filter(Boolean) : n.t === "ext" ? [["", n.child]] : [];
  const leaves = n => Math.max(1, kids(n).reduce((s, [, c]) => s + leaves(c), 0) + (n.t === "branch" && n.value ? 0 : 0));
  const depth = n => 1 + Math.max(0, ...kids(n).map(([, c]) => depth(c)));
  const W = Math.max(host.clientWidth, leaves(t) * (NW + GX)), H = depth(t) * (NH + GY) - GY + 30;
  const s = svgIn(host, W, H); s.setAttribute("width", W); s.setAttribute("height", H);
  const str = p => p.map(x => NIB[x]).join("");
  const place = (n, x0, y, parent) => {
    const w = leaves(n) * (NW + GX), cx = x0 + w / 2;
    let xx = x0;
    for (const [lab, c] of kids(n)) {
      const cw = leaves(c) * (NW + GX), ccx = xx + cw / 2;
      el(s, "path", { d: `M${cx},${y + NH} C${cx},${y + NH + GY / 2} ${ccx},${y + GY / 2 + NH / 2} ${ccx},${y + NH + GY}`, style: "fill:none;stroke:var(--rule-strong);stroke-width:1.6" });
      if (lab) { const lx = (cx + ccx) / 2, ly = y + NH + GY / 2; el(s, "circle", { cx: lx, cy: ly, r: 9, style: "fill:var(--eth);" }); el(s, "text", { x: lx, y: ly + 4, "text-anchor": "middle", style: "font-family:var(--f-mono);font-size:11px;font-weight:700;fill:#fff" }, lab); }
      place(c, xx, y + NH + GY, n); xx += cw;
    }
    const c = n.t === "branch" ? "var(--eth)" : n.t === "ext" ? "var(--m-chain)" : "var(--up)";
    const enc = rlp(nodeList(n)), inline = enc.length < 32 && n !== t;
    const g = el(s, "g", { class: "tn", "data-t": n.t, transform: `translate(${cx - NW / 2},${y})`, style: "cursor:default" });
    el(g, "rect", { width: NW, height: NH, rx: 8, style: `fill:color-mix(in srgb, ${c} 14%, var(--surface-1));stroke:${c};stroke-width:1.5` });
    el(g, "text", { x: 8, y: 15, ...TX(10, c, "font-weight:700;text-transform:uppercase;letter-spacing:.05em") }, n.t === "ext" ? "ext" : n.t);
    el(g, "text", { x: NW - 8, y: 15, "text-anchor": "end", ...TX(9.5) }, n === t ? "root" : inline ? "inline" : "#" + hex(keccak256(enc)).slice(0, 4));
    const line2 = n.t === "branch" ? (n.value ? `value “${new TextDecoder().decode(n.value)}”` : `${kids(n).length} of 16 used`) : n.t === "ext" ? `path ${str(n.path)}` : `${str(n.path) || "∅"} → “${new TextDecoder().decode(n.value)}”`;
    el(g, "text", { x: 8, y: 36, style: "font-family:var(--f-mono);font-size:11px;fill:var(--ink-1)" }, line2.length > 17 ? line2.slice(0, 16) + "…" : line2);
  };
  place(t, 0, 4, null);
}
$("trieView").addEventListener("mouseover", e => {
  const g = e.target.closest(".tn"), F = panes["src-insert"];
  if (!g) return F([]);
  F(g.dataset.t === "leaf" ? F.range(178, 182) : g.dataset.t === "ext" ? F.range(195, 214) : F.range(216, 221));
});
$("trieView").addEventListener("mouseleave", () => panes["src-insert"]([]));

/* ================================================================ 7. genesis */
let gSel = null;
function drawGenesis() {
  const items = GEN.fields.map(f => rlp(f[1])), tot = items.reduce((s, x) => s + x.length, 0);
  $("segbar").innerHTML = GEN.fields.map((f, i) => `<div data-i="${i}" title="${f[0]}: ${items[i].length} bytes" style="--c:${css(f[2])};flex:${items[i].length} 1 0" class="${gSel != null && gSel !== i ? "dim" : ""}"></div>`).join("");
  $("gtable").innerHTML = GEN.fields.map((f, i) => {
    const v = f[1], show = f[0] === "Difficulty" || f[0] === "GasLimit" || f[0] === "Number" || f[0] === "GasUsed" || f[0] === "Time" ? fmt(BigInt("0x" + (hex(v) || "0"))) : v.every(b => !b) ? `0x00 × ${v.length}` : "0x" + hex(v);
    return `<tr data-i="${i}" class="${gSel === i ? "on" : ""}" style="--c:${css(f[2])}"><td><i></i>${f[0]}</td><td class="v">${show}<small>${f[3]}</small></td></tr>`;
  }).join("");
  const h = genHash(), ok = h === GEN.hash;
  $("gHash").innerHTML = "0x" + h;
  $("gVerdict").innerHTML = (ok ? `<span class="ok">✓ This is Ethereum's block 0, 0xd4e56740…</span>` : `<span class="bad">mismatch</span>`) + ` The header's RLP is ${rlp(GEN.fields.map(f => f[1])).length} bytes: a list of the 15 fields above.`;
  const F = panes["src-header"];
  F(gSel != null ? F.find("\t" + GEN.fields[gSel][0] + " ") : F.find("return rlpHash(h)"));
}
const gHover = e => { const r = e.target.closest("[data-i]"); const i = r ? +r.dataset.i : null; if (i !== gSel) { gSel = i; drawGenesis(); } };
$("gtable").addEventListener("mouseover", gHover); $("segbar").addEventListener("mouseover", gHover);
$("gtable").addEventListener("mouseleave", () => { gSel = null; drawGenesis(); });

/* ================================================================ 8. difficulty */
const DS = { blocks: [], H: 1, D: 0, seed: 7, timer: null };
function rng() { let t = (DS.seed += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function diffReset() { clearInterval(DS.timer); DS.timer = null; $("dPlay").textContent = "▶ Play"; DS.seed = 7; DS.H = 1; DS.D = 18.76 * 2048; DS.blocks = []; DS.H0D = DS.D; for (let i = 0; i < 300; i++) diffStep(); drawDiff(); }
function diffStep() {
  const dt = Math.floor(-Math.log(1 - rng()) * DS.D / (DS.H * 2048));
  const up = dt < 13, adj = Math.floor(DS.D / 2048);
  DS.blocks.push({ dt, D: DS.D, H: DS.H, up });
  DS.D = up ? DS.D + adj : DS.D - adj;
  if (DS.blocks.length > 4000) DS.blocks.shift();
}
function drawDiff() {
  const host = $("dchart"), w = host.clientWidth, h = host.clientHeight, s = svgIn(host, w, h);
  const B = DS.blocks.slice(-3000), P = { l: 4, r: 52, t: 12, b: 22 }, mid = P.t + (h - P.t - P.b) * .52;
  const X = i => P.l + (w - P.l - P.r) * i / Math.max(1, B.length - 1);
  const ds = B.map(b => b.D), lo = Math.min(...ds) * .97, hi = Math.max(...ds) * 1.03;
  const YD = v => P.t + (mid - 14 - P.t) * (1 - (v - lo) / (hi - lo));
  const YT = t => mid + 8 + (h - P.b - mid - 8) * (1 - Math.min(80, t) / 80);
  el(s, "text", { x: P.l, y: P.t + 2, ...TX(11, "var(--ink-2)", "font-weight:600") }, "difficulty");
  el(s, "text", { x: P.l, y: mid + 4, ...TX(11, "var(--ink-2)", "font-weight:600") }, "block time (s)");
  el(s, "line", { x1: P.l, x2: w - P.r, y1: YT(13), y2: YT(13), style: "stroke:var(--eth);stroke-dasharray:4 3" });
  el(s, "text", { x: w - P.r + 6, y: YT(13) + 4, ...TX(10.5, "var(--eth)", "font-weight:700") }, "13 s");
  el(s, "text", { x: w - P.r + 6, y: YT(80) + 4, ...TX(10.5) }, "80 s+");
  const step = Math.max(1, Math.floor(B.length / (w * 1.2)));
  for (let i = 0; i < B.length; i += step) el(s, "circle", { cx: X(i), cy: YT(B[i].dt), r: 1.6, style: `fill:${B[i].up ? "var(--down)" : "var(--up)"};opacity:.55` });
  let d = ""; for (let i = 0; i < B.length; i += step) d += (d ? "L" : "M") + X(i).toFixed(1) + "," + YD(B[i].D).toFixed(1);
  el(s, "path", { d, style: "fill:none;stroke:var(--eth);stroke-width:2" });
  for (let i = 1; i < B.length; i++) if (B[i].H !== B[i - 1].H) {
    el(s, "line", { x1: X(i), x2: X(i), y1: P.t, y2: h - P.b, style: "stroke:var(--ink-2);stroke-dasharray:2 3" });
    el(s, "text", { x: X(i) + 4, y: h - P.b - 4, ...TX(10.5, "var(--ink-1)", "font-weight:600") }, `hashrate ${B[i].H >= 1 ? "×" + B[i].H : "÷" + 1 / B[i].H}`);
  }
  el(s, "text", { x: w - P.r + 6, y: YD(B[B.length - 1].D) + 4, ...TX(10.5, "var(--eth)", "font-weight:700") }, (B[B.length - 1].D / DS.H0D).toFixed(2) + "×");
  el(s, "text", { x: P.l, y: h - 5, ...TX(10.5) }, `last ${fmt(B.length)} blocks →`);
  const last = B.slice(-200).map(b => b.dt).sort((a, b) => a - b), med = last[last.length >> 1], mean = last.reduce((a, b) => a + b, 0) / last.length;
  $("dstats").innerHTML = [["blocks shown", fmt(B.length)], ["median time*", med + " s"], ["mean time*", mean.toFixed(1) + " s"], ["difficulty", (DS.D / DS.H0D).toFixed(2) + "× start"]]
    .map(([k, v]) => `<div class="kv"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("") + `<span class="hint" style="grid-column:1/-1">* last 200 blocks · red dot = under 13 s (difficulty goes up), green = 13 s or more (goes down)</span>`;
  const F = panes["src-calcdiff"], lb = DS.blocks[DS.blocks.length - 1];
  F(lb.up ? F.range(49, 50) : F.range(51, 53));
}
$("dPlay").onclick = () => {
  if (DS.timer) { clearInterval(DS.timer); DS.timer = null; $("dPlay").textContent = "▶ Play"; return; }
  $("dPlay").textContent = "❚❚ Pause";
  DS.timer = setInterval(() => { for (let i = 0; i < 24; i++) diffStep(); drawDiff(); }, 60);
};
$("dUp").onclick = () => { DS.H *= 2; if (!DS.timer) $("dPlay").click(); };
$("dDown").onclick = () => { DS.H /= 2; if (!DS.timer) $("dPlay").click(); };
$("dReset").onclick = diffReset;

/* ================================================================ 9. uncles */
const U = { n: 1, depth: [1, 2] };
function drawUncles() {
  $("pickers").innerHTML = `<div class="row"><span style="min-width:120px">Uncles included</span><div class="seg" id="uN">${[0, 1, 2].map(n => `<button type="button" data-n="${n}" aria-pressed="${U.n === n}">${n}</button>`).join("")}</div></div>` +
    [0, 1].filter(i => i < U.n).map(i => `<div class="row"><span style="min-width:120px">Uncle ${i + 1} is from</span><div class="seg" data-u="${i}">${[1, 2, 3, 4, 5, 6].map(d => `<button type="button" data-d="${d}" aria-pressed="${U.depth[i] === d}">N−${d}</button>`).join("")}</div></div>`).join("");
  // chain picture: blocks N-7..N, uncles sit at their own height, forked off the block before them
  const host = $("uncView"), bw = 50, gap = 16, W = Math.max(host.clientWidth, 8 * (bw + gap) + 20), H = 150;
  const s = svgIn(host, W, H); s.setAttribute("width", W); s.setAttribute("height", H);
  const X = d => 10 + (7 - d) * (bw + gap), yMain = 92;
  for (let d = 7; d >= 0; d--) {
    if (d < 7) el(s, "line", { x1: X(d + 1) + bw, x2: X(d), y1: yMain + 18, y2: yMain + 18, style: "stroke:var(--ink-2);stroke-width:1.6" });
    const g = el(s, "g", { transform: `translate(${X(d)},${yMain})` });
    el(g, "rect", { width: bw, height: 36, rx: 7, style: `fill:${d === 0 ? "color-mix(in srgb, var(--eth) 22%, var(--surface-1))" : "var(--surface-1)"};stroke:${d === 0 ? "var(--eth)" : "var(--rule-strong)"};stroke-width:${d === 0 ? 2.2 : 1.3}` });
    el(g, "text", { x: bw / 2, y: 23, "text-anchor": "middle", ...TX(11.5, "var(--ink-1)", "font-weight:700") }, d ? "N−" + d : "N");
  }
  for (let i = 0; i < U.n; i++) {
    const d = U.depth[i], x = X(d) + (i && U.depth[0] === d ? 10 : 0), y = 22 + (i && U.depth[0] === d ? 6 : 0);
    el(s, "path", { d: `M${X(d + 1) + bw},${yMain + 10} C${X(d + 1) + bw + 12},${y + 18} ${x - 12},${y + 18} ${x},${y + 18}`, style: "fill:none;stroke:var(--m-chain);stroke-width:1.4" });
    el(s, "path", { d: `M${X(0) + bw / 2},${yMain} C${X(0) + bw / 2},${y - 14} ${x + bw / 2},${y - 14} ${x + bw / 2},${y}`, style: "fill:none;stroke:var(--m-chain);stroke-dasharray:4 3;stroke-width:1.4" });
    const g = el(s, "g", { transform: `translate(${x},${y})` });
    el(g, "rect", { width: bw, height: 36, rx: 7, style: "fill:color-mix(in srgb, var(--m-chain) 16%, var(--surface-1));stroke:var(--m-chain);stroke-width:1.4" });
    el(g, "text", { x: bw / 2, y: 16, "text-anchor": "middle", ...TX(10.5, "var(--ink-1)", "font-weight:700") }, "uncle");
    el(g, "text", { x: bw / 2, y: 29, "text-anchor": "middle", ...TX(9.5) }, "h = N−" + d);
  }
  const R = 5, pays = [["Miner of block N", R + U.n * R / 32, "--eth", `5 + ${U.n} × 5/32`]];
  for (let i = 0; i < U.n; i++) pays.push([`Uncle ${i + 1} miner (N−${U.depth[i]})`, (8 - U.depth[i]) / 8 * R, "--m-chain", `(u + 8 − N) / 8 × 5 = ${8 - U.depth[i]}/8 × 5`]);
  $("payouts").innerHTML = pays.map(([lb, v, c, f]) => `<div class="pay" title="${f}"><span>${lb}</span><span class="tr"><span style="width:${v / 5.32 * 100}%;--c:${css(c)}"></span></span><span class="n">${v.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")} ETH</span></div>`).join("");
  const total = pays.reduce((s2, p) => s2 + p[1], 0);
  $("uncNote").innerHTML = `New ether created by block N: <b>${total.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")} ETH</b>. A fresher uncle pays more: one block old earns 7/8 of a full reward, six blocks old 2/8. There is no halving: Frontier issues 5 ETH per block for good. Later forks cut it to 3, then 2, and the 2022 switch to proof of stake ended mining.`;
  const F = panes["src-rewards"];
  F(U.n ? F.range(287, 297) : F.find("reward := new(big.Int).Set(BlockReward)", "statedb.AddBalance(header.Coinbase, reward)"));
}
$("pickers").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.n != null) U.n = +b.dataset.n; else if (b.dataset.d != null) U.depth[+b.closest("[data-u]").dataset.u] = +b.dataset.d;
  drawUncles();
});

/* ================================================================ boot */
drawTreemap(); fileInfo(tmSel);
worldReset();
drawTx();
evmLoad();
drawGas();
drawKV(); drawTrie();
drawGenesis();
diffReset();
drawUncles();
panes["src-sighash"](panes["src-sighash"].range(151, 158));
let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { drawTreemap(); drawTrie(); drawDiff(); drawUncles(); }, 120); });
})();
