/* "Satoshi's code" page (satoshi.html): an interactive explainer of the original Bitcoin v0.1 source.
   Every hash is computed here with a plain-JS SHA-256; the genesis block is rebuilt from the values in v0.1's main.cpp
   and checked against hashGenesisBlock on load. No libraries. */
(function () {
"use strict";

const K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const W = new Uint32Array(64);
function sha256(msg) {
  const l = msg.length, nb = ((l + 9 + 63) >> 6) << 6, b = new Uint8Array(nb);
  b.set(msg); b[l] = 0x80;
  const dv = new DataView(b.buffer);
  dv.setUint32(nb - 4, (l * 8) >>> 0); dv.setUint32(nb - 8, Math.floor(l / 0x20000000));
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  for (let o = 0; o < nb; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = W[i - 15], y = W[i - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let a = h0, b_ = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (S0 + ((a & b_) ^ (a & c) ^ (b_ & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b_; b_ = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b_) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }
  const out = new Uint8Array(32), ov = new DataView(out.buffer);
  [h0, h1, h2, h3, h4, h5, h6, h7].forEach((v, i) => ov.setUint32(i * 4, v));
  return out;
}
const dsha = m => sha256(sha256(m));                       // Hash() in util.h: SHA-256 twice
const hex = u => Array.from(u, x => x.toString(16).padStart(2, "0")).join("");
const unhex = s => Uint8Array.from(s.match(/../g) || [], x => parseInt(x, 16));
const rhex = u => hex(Uint8Array.from(u).reverse());      // uint256::GetHex prints bytes backwards
const ascii = s => Uint8Array.from(s, c => c.charCodeAt(0) & 0xff);
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
const le32 = v => { const o = new Uint8Array(4); new DataView(o.buffer).setUint32(0, v >>> 0, true); return o; };

const GENESIS = {
  text: "The Times 03/Jan/2009 Chancellor on brink of second bailout for banks",
  pubkey: "04678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f",
  nVersion: 1, nTime: 1231006505, nBits: 0x1d00ffff, nNonce: 2083236893,
  hash: "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
  merkle: "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
};
// the coinbase transaction, laid out field by field as CTransaction serialises it
function coinbaseParts(text) {
  const t = ascii(text.slice(0, 75));
  const sig = cat(unhex("04ffff001d"), unhex("0104"), Uint8Array.of(t.length), t);  // 486604799, CBigNum(4), the headline
  return [
    ["nVersion", le32(1)],
    ["vin.size", Uint8Array.of(1)],
    ["prevout.hash", new Uint8Array(32)],
    ["prevout.n", unhex("ffffffff")],
    ["scriptSig.size", Uint8Array.of(sig.length)],
    ["scriptSig", sig],
    ["nSequence", unhex("ffffffff")],
    ["vout.size", Uint8Array.of(1)],
    ["nValue", unhex("00f2052a01000000")],
    ["scriptPubKey.size", Uint8Array.of(0x43)],
    ["scriptPubKey", cat(Uint8Array.of(0x41), unhex(GENESIS.pubkey), Uint8Array.of(0xac))],
    ["nLockTime", le32(0)],
  ];
}
function headerParts(merkleRaw, nonce, time = GENESIS.nTime, bits = GENESIS.nBits) {
  return [
    ["nVersion", le32(1)], ["hashPrevBlock", new Uint8Array(32)], ["hashMerkleRoot", merkleRaw],
    ["nTime", le32(time)], ["nBits", le32(bits)], ["nNonce", le32(nonce)],
  ];
}
// SetCompact: 0x1d00ffff -> 0x00ffff * 256^(0x1d-3), as a 64-char display hex
function targetHex(bits) {
  const n = bits >>> 24, m = (bits & 0x7fffff).toString(16).padStart(6, "0");
  return (m + "0".repeat(2 * (n - 3))).padStart(64, "0").slice(-64);
}

/* ================================================================ page helpers */
const $ = id => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = n => n.toLocaleString("en-US");
const short = h => h.slice(0, 8) + "…" + h.slice(-4);
const css = v => `var(${v})`;
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

/* ================================================================ code panes */
const CPP_KW = /\b(int|unsigned|char|const|bool|return|if|else|for|while|foreach|loop|class|public|static|void|true|false|new|delete|case|break|switch|mutable|this|assert|default|NULL)\b/;
const CPP_TY = /\b(C[A-Z]\w*|uint256|uint160|int64|valtype|vector|map|string|opcodetype)\b/;
function highlight(line) {
  const re = new RegExp(`(\\/\\/.*$|\\/\\*.*?\\*\\/)|("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')|\\b(0x[0-9a-fA-F]+|\\d+)\\b|${CPP_KW.source}|${CPP_TY.source}|([A-Za-z_]\\w*)(?=\\s*\\()`, "g");
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
const REPO = "https://github.com/trottier/original-bitcoin/blob/master/src/";
// renders a <script type="text/plain"> excerpt; returns focus(lines) and a finder for line numbers by text
function codePane(host, srcId) {
  const src = $(srcId), file = src.dataset.file, title = src.dataset.title;
  const ranges = src.dataset.ranges.split(",").map(r => r.split("-").map(Number));
  const lines = src.textContent.split("\n");
  const ind = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
  let k = 0, body = "";
  const nums = [];
  ranges.forEach(([a, b], ri) => {
    if (ri) body += `<span class="ln gap">    ⋯</span>`;
    for (let n = a; n <= b; n++) { body += `<span class="ln" data-n="${n}">${highlight(lines[k].slice(ind)) || " "}</span>`; nums.push([n, lines[k]]); k++; }
  });
  const a0 = ranges[0][0], b1 = ranges[ranges.length - 1][1];
  host.className = "code";
  host.innerHTML = `<div class="bar"><i></i><i></i><i></i><b>${file}</b><span class="t">· ${title}</span>
    <a href="${REPO}${file}#L${a0}-L${b1}" target="_blank" rel="noopener">source ↗</a></div><pre>${body}</pre>`;
  const spans = [...host.querySelectorAll(".ln[data-n]")];
  const focus = ls => {
    const set = new Set(ls);
    host.classList.toggle("focus", set.size > 0);
    spans.forEach(s => s.classList.toggle("on", set.has(+s.dataset.n)));
  };
  focus.find = (...needles) => nums.filter(([, t]) => needles.some(nd => t.includes(nd))).map(([n]) => n);
  focus.range = (a, b) => nums.filter(([n]) => n >= a && n <= b).map(([n]) => n);
  return focus;
}
const panes = {};
document.querySelectorAll(".code[data-src]").forEach(h => { panes[h.dataset.src] = codePane(h, h.dataset.src); });

/* ================================================================ hero */
const FILES = [
  { f: "main.cpp", n: 2660, m: "core", d: "The heart of Bitcoin. Checking transactions and blocks, connecting them to the chain, switching to a longer chain, the miner, and the handler for every network message. Chapters 3, 4, 7, 8 and 9 all quote it." },
  { f: "main.h", n: 1317, m: "core", d: "The data structures: CTransaction, CTxIn, CTxOut, COutPoint, CBlock, CBlockIndex, and the Merkle tree builder. Chapters 2, 3 and 5." },
  { f: "script.cpp", n: 1127, m: "script", d: "EvalScript(), the interpreter for Bitcoin's stack language, plus signature hashing, signing, and the two standard payment templates. Chapter 6." },
  { f: "script.h", n: 597, m: "script", d: "The opcode list (OP_DUP, OP_HASH160, OP_CHECKSIG…) and the CScript class that builds scripts with the << operator." },
  { f: "net.cpp", n: 1067, m: "net", d: "Sockets and threads: connecting to peers, sending and receiving messages, relaying inventory. Also includes code to work through a SOCKS proxy." },
  { f: "net.h", n: 856, m: "net", d: "CNode (a connected peer), CAddress, CInv (announces \"I have block/tx X\"), and the message header with its magic bytes." },
  { f: "irc.cpp", n: 288, m: "net", d: "Peer discovery. Bitcoin v0.1 found other nodes by joining an IRC channel and reading the addresses encoded in other users' nicknames." },
  { f: "irc.h", n: 7, m: "net", d: "Two declarations for irc.cpp." },
  { f: "db.cpp", n: 608, m: "db", d: "Storage on Berkeley DB: the block index, the transaction index (which outputs are spent), known peer addresses and the wallet." },
  { f: "db.h", n: 420, m: "db", d: "CTxDB, CWalletDB, CAddrDB: the database wrapper classes." },
  { f: "uint256.h", n: 750, m: "crypto", d: "A 256-bit unsigned integer type. Every hash is one. Its GetHex() prints the bytes backwards, which is why block hashes are shown with their zeros at the front." },
  { f: "bignum.h", n: 498, m: "crypto", d: "A wrapper around OpenSSL's BIGNUM. Turns the 32-bit nBits into a full 256-bit target (SetCompact) and back (GetCompact). Chapter 7." },
  { f: "sha.cpp", n: 554, m: "crypto", d: "SHA-256, taken from Wei Dai's Crypto++ library. Hash() runs it twice." },
  { f: "sha.h", n: 177, m: "crypto", d: "Declarations for sha.cpp." },
  { f: "key.h", n: 156, m: "crypto", d: "CKey: secp256k1 elliptic-curve keys via OpenSSL. Making keys, signing, verifying." },
  { f: "base58.h", n: 201, m: "crypto", d: "Base58 encoding for addresses. It drops 0, O, I and l so addresses are hard to misread." },
  { f: "serialize.h", n: 1151, m: "plumb", d: "Turns objects into bytes for disk, network and hashing. The IMPLEMENT_SERIALIZE macro in every class comes from here." },
  { f: "util.h", n: 399, m: "plumb", d: "Shared helpers: logging, locks, the foreach and loop macros, and the Hash() function." },
  { f: "util.cpp", n: 379, m: "plumb", d: "Random numbers, error printing, and network-adjusted time (the median of the clocks your peers report)." },
  { f: "headers.h", n: 71, m: "plumb", d: "One file that includes every other header." },
  { f: "ui.cpp", n: 3228, m: "gui", d: "The Windows wallet built with wxWidgets: send and receive, address book, the transaction list, and the 'Generate Coins' menu switch that started the miner." },
  { f: "uibase.cpp", n: 1806, m: "gui", d: "Window layouts generated by the wxFormBuilder tool, not written by hand." },
  { f: "uibase.h", n: 720, m: "gui", d: "Generated declarations for uibase.cpp." },
  { f: "ui.h", n: 418, m: "gui", d: "Declarations for the hand-written GUI." },
  { f: "market.cpp", n: 264, m: "market", d: "The start of a peer-to-peer marketplace with product listings and user reviews. It shipped unfinished and was later removed." },
  { f: "market.h", n: 182, m: "market", d: "Declarations for market.cpp." },
];
const MODS = {
  core: { lb: "Core: blocks & chain", c: "--m-core" }, script: { lb: "Script", c: "--m-script" }, net: { lb: "Networking", c: "--m-net" },
  db: { lb: "Storage", c: "--m-db" }, crypto: { lb: "Crypto & numbers", c: "--m-crypto" }, plumb: { lb: "Plumbing", c: "--m-plumb" },
  gui: { lb: "Windows GUI", c: "--m-gui" }, market: { lb: "Unfinished marketplace", c: "--m-market" },
};
const TOTAL = FILES.reduce((s, f) => s + f.n, 0);
$("stLines").textContent = fmt(TOTAL);
$("stFiles").textContent = `in ${FILES.length} source files`;

function genesisCheck() {
  const tx = cat(...coinbaseParts(GENESIS.text).map(p => p[1]));
  const hd = cat(...headerParts(dsha(tx), GENESIS.nNonce).map(p => p[1]));
  const h = rhex(dsha(hd)), ok = h === GENESIS.hash;
  $("stGen").textContent = h;
  $("stGenS").innerHTML = ok ? "<b>✓</b> matches hashGenesisBlock in main.cpp" : "mismatch";
}
genesisCheck();

(function rain() {
  const cv = $("rain"), g = cv.getContext("2d");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let cols = [], w = 0, h = 0, raf;
  const size = () => {
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    w = r.width; h = r.height; cv.width = w * dpr; cv.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Array.from({ length: Math.ceil(w / 18) }, () => ({ y: Math.random() * h, v: .4 + Math.random() * 1.1 }));
  };
  size(); window.addEventListener("resize", size);
  const H = "0123456789abcdef";
  let vis = true;
  new IntersectionObserver(es => { vis = es[0].isIntersecting; }).observe(cv);
  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (!vis) return;
    g.fillStyle = "rgba(14,11,7,.16)"; g.fillRect(0, 0, w, h);
    g.font = "13px JetBrains Mono, monospace";
    cols.forEach((c, i) => {
      g.fillStyle = Math.random() < .02 ? "rgba(253,186,116,.9)" : "rgba(247,147,26,.35)";
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
let tmSel = "main.cpp";
function drawTreemap() {
  const host = $("treemap"), W = host.clientWidth, Hh = host.clientHeight;
  const groups = Object.keys(MODS).map(m => ({ m, v: FILES.filter(f => f.m === m).reduce((s, f) => s + f.n, 0) })).sort((a, b) => b.v - a.v);
  let html = "";
  for (const gr of squarify(groups, 0, 0, W, Hh)) {
    const files = FILES.filter(f => f.m === gr.i.m).map(f => ({ ...f, v: f.n })).sort((a, b) => b.v - a.v);
    for (const r of squarify(files, gr.x, gr.y, gr.w, gr.h)) {
      const f = r.i, big = r.w > 64 && r.h > 34;
      html += `<button type="button" class="tm${f.m === "gui" ? " gui" : ""}" data-f="${f.f}" aria-pressed="${f.f === tmSel}" title="${f.f} · ${fmt(f.n)} lines"
        style="--c:${css(MODS[f.m].c)};left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px">${big ? `<div class="f">${f.f}</div><div class="n">${fmt(f.n)}</div>` : ""}</button>`;
    }
  }
  host.innerHTML = html;
  $("tmLegend").innerHTML = Object.values(MODS).map(m => `<span><i class="sw" style="--c:${css(m.c)}"></i>${m.lb}</span>`).join("");
}
function fileInfo(name) {
  tmSel = name;
  const f = FILES.find(x => x.f === name), M = MODS[f.m];
  document.querySelectorAll(".tm").forEach(b => b.setAttribute("aria-pressed", b.dataset.f === name));
  const modN = FILES.filter(x => x.m === f.m).reduce((s, x) => s + x.n, 0);
  $("fileinfo").innerHTML = `<span class="tag" style="--c:${css(M.c)}"><i class="sw" style="--c:${css(M.c)}"></i>${M.lb}</span>
    <h3>${f.f}</h3><div class="lines">${fmt(f.n)} lines · ${(f.n / TOTAL * 100).toFixed(1)}% of the codebase</div>
    <p>${f.d}</p>
    <div class="bar100" title="${M.lb}: ${(modN / TOTAL * 100).toFixed(0)}% of all lines"><span style="width:${modN / TOTAL * 100}%;--c:${css(M.c)}"></span></div>
    <p class="hint" style="margin-top:6px">${M.lb}: ${fmt(modN)} lines, ${(modN / TOTAL * 100).toFixed(0)}% of the total</p>
    <p class="hint" style="margin-top:14px"><a href="${REPO}${f.f}" target="_blank" rel="noopener">Read ${f.f} on GitHub ↗</a></p>`;
}
$("treemap").addEventListener("click", e => { const b = e.target.closest(".tm"); if (b) fileInfo(b.dataset.f); });
$("treemap").addEventListener("mouseover", e => { const b = e.target.closest(".tm"); if (b) fileInfo(b.dataset.f); });

/* ================================================================ 2. transactions */
const txid = s => rhex(dsha(ascii(s)));
const TXS = [
  { id: "A", title: "Block reward", sub: "coinbase", hash: txid("coinbase A"), vin: [{ cb: true }], vout: [{ who: "Alice", v: 50 }] },
  { id: "B", title: "Alice pays Bob", hash: txid("alice to bob"), vin: [{ from: "A", n: 0 }], vout: [{ who: "Bob", v: 10 }, { who: "Alice (change)", v: 40 }] },
  { id: "C", title: "Bob pays Carol", hash: txid("bob to carol"), vin: [{ from: "B", n: 0 }], vout: [{ who: "Carol", v: 10 }] },
];
const DS = { id: "D", title: "Alice pays Dave", hash: txid("alice to dave"), vin: [{ from: "A", n: 0 }], vout: [{ who: "Dave", v: 50 }], reject: true };
let dsOn = false;
function txCards() {
  const list = dsOn ? [...TXS, DS] : TXS;
  const spent = new Set(); TXS.forEach(t => t.vin.forEach(i => i.from && spent.add(i.from + ":" + i.n)));
  $("txflow").innerHTML = `<svg class="links" id="txlinks"></svg>` + list.map(t => `
    <div class="tx${t.reject ? " reject" : ""}" data-t="${t.id}">
      <div class="hd"><b>${t.title}</b><span>${short(t.hash)}</span></div>
      <div class="sec"><div class="lb">vin · inputs</div>${t.vin.map((i, k) => i.cb
        ? `<div class="io in"><span class="who">coinbase</span><span class="pt">no input: new coins</span></div>`
        : `<div class="io in" data-from="${i.from}:${i.n}" data-me="${t.id}"><span class="pt">prevout = (${TXS.find(x => x.id === i.from).hash.slice(0, 6)}…, ${i.n})</span></div>`).join("")}</div>
      <div class="sec"><div class="lb">vout · outputs</div>${t.vout.map((o, n) => `<div class="io out${spent.has(t.id + ":" + n) ? " spent" : ""}" data-out="${t.id}:${n}"><span class="who">#${n} ${o.who}</span><span class="amt">${o.v} BTC</span></div>`).join("")}</div>
      ${t.reject ? `<span class="stamp">REJECTED</span>` : ""}
    </div>`).join("");
  requestAnimationFrame(txLinks);
}
function txLinks() {
  const box = $("txflow"), sv = $("txlinks"), R = box.getBoundingClientRect();
  sv.setAttribute("viewBox", `0 0 ${R.width} ${R.height}`);
  sv.innerHTML = "";
  box.querySelectorAll(".io.in[data-from]").forEach(inp => {
    const out = box.querySelector(`.io.out[data-out="${inp.dataset.from}"]`); if (!out) return;
    const a = out.getBoundingClientRect(), b = inp.getBoundingClientRect();
    const bad = inp.dataset.me === "D";
    let d;
    if (b.left > a.right - 4) { const x1 = a.right - R.left, y1 = a.top + a.height / 2 - R.top, x2 = b.left - R.left, y2 = b.top + b.height / 2 - R.top; d = `M${x1},${y1} C${x1 + 30},${y1} ${x2 - 30},${y2} ${x2},${y2}`; }
    else { const x1 = a.left - R.left, y1 = a.top + a.height / 2 - R.top, x2 = b.left - R.left, y2 = b.top + b.height / 2 - R.top, bx = Math.min(x1, x2) - 22; d = `M${x1},${y1} C${bx},${y1} ${bx},${y2} ${x2},${y2}`; }
    el(sv, "path", { d, "data-k": inp.dataset.from + ">" + inp.dataset.me, style: `fill:none;stroke:${bad ? "var(--down)" : "var(--btc)"};stroke-width:2;${bad ? "stroke-dasharray:5 4;" : ""}opacity:.75` });
  });
}
$("txflow").addEventListener("mouseover", e => {
  const inp = e.target.closest(".io.in[data-from]");
  document.querySelectorAll(".io.hot").forEach(x => x.classList.remove("hot"));
  if (!inp) return;
  inp.classList.add("hot");
  const out = $("txflow").querySelector(`.io.out[data-out="${inp.dataset.from}"]`); if (out) out.classList.add("hot");
});
const focusConflict = panes["src-conflict"];
$("dsBtn").onclick = () => {
  dsOn = true; txCards(); $("dsBtn").hidden = true; $("dsReset").hidden = false;
  $("dsNote").innerHTML = `Alice signs a second transaction that spends the same output <b>(${TXS[0].hash.slice(0, 6)}…, 0)</b> to Dave. Her signature is valid, so <code>VerifySignature</code> passes. But <code>ConnectInputs()</code> looks up that output in the transaction index, finds <code>vSpent[0]</code> already set by the payment to Bob, and refuses: <b>“prev tx already used”</b>. Whichever spend gets into the chain first is the only one that counts.`;
  focusConflict(focusConflict.find("Check for conflicts", "vSpent[prevout.n].IsNull", "prev tx already used"));
};
$("dsReset").onclick = () => {
  dsOn = false; txCards(); $("dsBtn").hidden = false; $("dsReset").hidden = true; focusConflict([]);
  $("dsNote").innerHTML = "Outputs are spent whole. To pay Bob 10 out of 50, Alice spends the whole 50 output and sends 40 back to herself as <b>change</b>.";
};

/* ================================================================ 3. header + headline */
const S = { text: GENESIS.text };
const FIELDS = [
  { k: "nVersion", c: "--f-ver", b: 4 }, { k: "hashPrevBlock", c: "--f-prev", b: 32 }, { k: "hashMerkleRoot", c: "--f-root", b: 32 },
  { k: "nTime", c: "--f-time", b: 4 }, { k: "nBits", c: "--f-bits", b: 4 }, { k: "nNonce", c: "--f-nonce", b: 4 },
];
const focusCBlock = panes["src-cblock"];
function build(text, nonce = GENESIS.nNonce) {
  const parts = coinbaseParts(text), tx = cat(...parts.map(p => p[1])), id = dsha(tx);
  const hp = headerParts(id, nonce), hd = cat(...hp.map(p => p[1]));
  return { parts, tx, id, hp, hd, hash: rhex(dsha(hd)) };
}
const meetsTarget = (hHex, bits) => hHex <= targetHex(bits);
function zeroLead(h) { const m = h.match(/^0*/)[0].length; return `<span class="z">${h.slice(0, m)}</span>${h.slice(m)}`; }
let hSel = null;
function fieldDesc(k, B) {
  const t = new Date(GENESIS.nTime * 1000).toISOString().replace("T", " ").slice(0, 19);
  return {
    nVersion: ["1", "Block format version."],
    hashPrevBlock: ["0", "The hash of the previous block: this is what chains blocks together. Block 0 has no parent, so it's all zeros."],
    hashMerkleRoot: [rhex(B.id), "One hash summarising every transaction in the block (chapter 5). Block 0 has a single transaction, so the root is just that transaction's hash."],
    nTime: [`${GENESIS.nTime} = ${t} UTC`, "Unix time when the miner started on the block."],
    nBits: [`0x1d00ffff → target ${targetHex(GENESIS.nBits).slice(0, 16)}…`, "The difficulty, packed into 4 bytes: 0x00ffff × 256^(0x1d − 3). The hash must be at or below this number."],
    nNonce: [fmt(GENESIS.nNonce), "The number the miner kept changing until the hash fell below the target (chapter 4)."],
  }[k];
}
function drawHeader() {
  const B = build(S.text);
  $("hbar").innerHTML = FIELDS.map(f => `<div data-k="${f.k}" style="--c:${css(f.c)};flex:${f.b} 1 0" class="${hSel && hSel !== f.k ? "dim" : ""}">${f.b >= 32 ? f.k : { nVersion: "Ver", nTime: "Time", nBits: "Bits", nNonce: "Nonce" }[f.k]}<small>${f.b} B</small></div>`).join("");
  let html = "", off = 0;
  B.hp.forEach(([k, bytes], fi) => { for (const x of bytes) html += `<span data-k="${k}" style="--c:${css(FIELDS[fi].c)}" class="${hSel ? (hSel === k ? "on" : "dim") : ""}">${x.toString(16).padStart(2, "0")}</span>`; off += bytes.length; });
  $("hbytes").innerHTML = html;
  const k = hSel || "nNonce", [val, what] = fieldDesc(k, B), raw = B.hp.find(p => p[0] === k)[1];
  $("hfield").innerHTML = `<dt>field</dt><dd style="color:${css(FIELDS.find(f => f.k === k).c)};font-weight:700">${k}</dd><dt>bytes</dt><dd>${hex(raw)}${raw.length === 4 ? " (little-endian)" : ""}</dd><dt>value</dt><dd>${esc(val)}</dd><dt></dt><dd style="font-family:var(--f-text);font-size:13px;color:var(--ink-2)">${what}</dd>`;
  const ok = meetsTarget(B.hash, GENESIS.nBits);
  $("hHash").className = "h" + (ok ? "" : " badh");
  $("hHash").innerHTML = zeroLead(B.hash);
  $("hVerdict").innerHTML = ok
    ? `<span class="ok">✓ at or below the target ${targetHex(GENESIS.nBits).slice(0, 12)}…</span> — this is block 0, <code>000000000019d6…</code>, exactly as hard-coded in <code>hashGenesisBlock</code>.`
    : `<span class="bad">✗ above the target.</span> Your edited headline changed the Merkle root, so Satoshi's nonce no longer works. The block is invalid until someone mines it again.`;
  focusCBlock(hSel ? focusCBlock.find(" " + hSel + ";") : []);
}
function hoverField(e) { const t = e.target.closest("[data-k]"); const k = t ? t.dataset.k : null; if (k !== hSel) { hSel = k; drawHeader(); } }
$("hbar").addEventListener("mouseover", hoverField); $("hbytes").addEventListener("mouseover", hoverField);
$("hbar").addEventListener("mouseleave", () => { hSel = null; drawHeader(); }); $("hbytes").addEventListener("mouseleave", () => { hSel = null; drawHeader(); });

const G0 = build(GENESIS.text);
function drawHeadline() {
  const B = build(S.text), sig = B.parts.find(p => p[0] === "scriptSig")[1], tlen = sig[7];
  let h = "";
  sig.forEach((x, i) => {
    const hx = x.toString(16).padStart(2, "0");
    if (i >= 8) h += `<span class="txt">${hx}<small>${esc(String.fromCharCode(x)).replace(" ", "␣")}</small></span>`;
    else h += `<span class="pre" title="${i < 5 ? "push 486604799 (= 0x1d00ffff)" : i < 7 ? "push CBigNum(4)" : "push " + tlen + " bytes"}">${hx}</span>`;
  });
  $("sigbytes").innerHTML = h;
  const steps = [
    ["Headline", `${S.text.length} bytes`, S.text !== GENESIS.text, esc(S.text)],
    ["Coinbase tx", `${B.tx.length} bytes`, hex(B.tx) !== hex(G0.tx), hex(B.tx)],
    ["Tx hash = Merkle root", "", rhex(B.id) !== rhex(G0.id), rhex(B.id)],
    ["Header", "80 bytes", hex(B.hd) !== hex(G0.hd), hex(B.hd)],
    ["Block hash", "", B.hash !== G0.hash, B.hash],
  ];
  $("ripple").innerHTML = steps.map(([a, n, chg, v], i) => `<div class="step${chg ? " chg" : ""}"><i>${i + 1}</i><b>${a}${n ? ` <span class="hint">${n}</span>` : ""}</b><code>${v}</code></div>`).join("");
  drawHeader(); minerTarget();
}
$("hl").value = S.text;
$("hl").addEventListener("input", () => { S.text = $("hl").value.replace(/[^\x20-\x7e]/g, "?"); stopMining(); drawHeadline(); });
$("hlReset").onclick = () => { S.text = GENESIS.text; $("hl").value = S.text; stopMining(); drawHeadline(); };

/* ================================================================ 4. mining */
const M = { z: 5, on: false, nonce: 0, tried: 0, t0: 0, rate: 0, hd: null, lines: [], found: null };
const focusMiner = panes["src-miner"];
$("zeroSeg").innerHTML = [3, 4, 5, 6].map(z => `<button type="button" data-z="${z}">${z} zeros</button>`).join("");
$("zeroSeg").addEventListener("click", e => { const b = e.target.closest("button"); if (b) { M.z = +b.dataset.z; stopMining(); minerTarget(); } });
function minerTarget() {
  document.querySelectorAll("#zeroSeg button").forEach(b => b.setAttribute("aria-pressed", +b.dataset.z === M.z));
  const t = "0".repeat(M.z) + "f".repeat(64 - M.z);
  $("tgtHex").innerHTML = `<span class="z">${t.slice(0, M.z)}</span>${t.slice(M.z)}`;
  $("tgtCap").innerHTML = `Target: the hash must start with <b>${M.z} zero hex digits</b>. Each digit is 16× harder, so expect about <b>${fmt(16 ** M.z)}</b> tries. Satoshi's real target needed 8 zeros and then some.`;
  $("mExp").textContent = fmt(16 ** M.z);
  $("mineHeadline").textContent = S.text === GENESIS.text ? "Header: block 0, nonce reset to 0" : "Header: your edited block 0";
  if (!M.on) { $("mNonce").textContent = "0"; $("mTried").textContent = "0"; $("found").hidden = true; $("stream").innerHTML = ""; }
  realDiffNote();
}
function realDiffNote() {
  const exp = 2 ** 32 * (0x10000 / 0xffff);   // 2^256 / (target + 1)
  const r = M.rate;
  $("realDiff").innerHTML = `<b>Satoshi's real target</b> (<code>nBits = 0x1d00ffff</code>) needs on average about <b>${(exp / 1e9).toFixed(2)} billion</b> hashes per block.` +
    (r ? ` At your browser's ${fmt(Math.round(r))} hashes a second, that is about <b>${(exp / r / 3600).toFixed(1)} hours</b> for one block. Satoshi's nonce, ${fmt(GENESIS.nNonce)}, is the one that worked.` : " Start the miner to see how long your browser would need.");
}
function stopMining() { M.on = false; $("mineBtn").textContent = "▶ Start mining"; focusMiner([]); }
function okZeros(h, z) {   // raw hash bytes are little-endian: the displayed leading zeros are the last bytes
  for (let k = 0; k < (z >> 1); k++) if (h[31 - k]) return false;
  return z & 1 ? (h[31 - (z >> 1)] >> 4) === 0 : true;
}
function mineFrame() {
  if (!M.on) return;
  const t = performance.now(), hd = M.hd, dv = new DataView(hd.buffer);
  let h, win = false;
  while (performance.now() - t < 14) {
    for (let k = 0; k < 1024; k++) {
      dv.setUint32(76, M.nonce, true);
      h = dsha(hd); M.tried++;
      if (okZeros(h, M.z)) { win = true; break; }
      M.nonce = (M.nonce + 1) >>> 0;
    }
    if (win) break;
  }
  const el2 = (performance.now() - M.t0) / 1000; M.rate = M.tried / el2;
  const disp = rhex(h);
  M.lines.unshift(`<div${win ? ' class="win"' : ""}><b>${fmt(M.nonce)}</b> ${zeroLead(disp).replace('class="z"', 'class="z"')}</div>`);
  M.lines.length = Math.min(M.lines.length, 11);
  $("stream").innerHTML = M.lines.join("");
  $("mNonce").textContent = fmt(M.nonce); $("mTried").textContent = fmt(M.tried); $("mRate").textContent = (M.rate / 1000).toFixed(0) + "k/s";
  if (win) {
    stopMining();
    focusMiner(focusMiner.range(2315, 2318));
    $("found").hidden = false;
    $("found").innerHTML = `<b class="ok">Proof of work found after ${fmt(M.tried)} hashes (${el2.toFixed(1)} s).</b><br>
      nNonce = <span class="mono">${fmt(M.nonce)}</span><br><span class="mono">${zeroLead(disp)}</span><br>
      <span class="hint">Change one character of the headline in chapter 3 and this nonce stops working: you'd have to mine again.</span>`;
    realDiffNote();
    return;
  }
  requestAnimationFrame(mineFrame);
}
$("mineBtn").onclick = () => {
  if (M.on) return stopMining();
  M.hd = build(S.text, 0).hd.slice(); M.nonce = 0; M.tried = 0; M.t0 = performance.now(); M.lines = []; $("found").hidden = true;
  M.on = true; $("mineBtn").textContent = "❚❚ Stop";
  focusMiner(focusMiner.range(2309, 2315));
  requestAnimationFrame(mineFrame);
};

/* ================================================================ 5. merkle */
const MK = { n: 5, bad: new Set() };
const focusMerkle = panes["src-merkle"];
function merkle(n, bad) {
  const levels = [[]];
  for (let i = 0; i < n; i++) levels[0].push({ h: dsha(ascii("tx" + i + (bad.has(i) ? " (tampered)" : ""))), kids: [], i });
  for (let size = n; size > 1; size = (size + 1) >> 1) {
    const prev = levels[levels.length - 1], next = [];
    for (let i = 0; i < size; i += 2) {
      const i2 = Math.min(i + 1, size - 1);
      next.push({ h: dsha(cat(prev[i].h, prev[i2].h)), kids: [i, i2], dup: i2 === i });
    }
    levels.push(next);
  }
  return levels;
}
function drawMerkle() {
  const host = $("mk"), W = Math.max(320, host.clientWidth), H = host.clientHeight;
  const L = merkle(MK.n, MK.bad), L0 = merkle(MK.n, new Set());
  const s = svgIn(host, W, H), rows = L.length, bw = Math.min(92, (W - 20) / MK.n - 8), bh = 34;
  const Y = r => H - 24 - r * ((H - 60) / Math.max(1, rows - 1)) - bh / 2;
  const xs = [L[0].map((_, i) => 10 + (W - 20) * (i + .5) / MK.n)];
  for (let r = 1; r < rows; r++) xs.push(L[r].map(nd => (xs[r - 1][nd.kids[0]] + xs[r - 1][nd.kids[1]]) / 2));
  for (let r = 1; r < rows; r++) L[r].forEach((nd, j) => {
    const x = xs[r][j], y = Y(r);
    nd.kids.forEach((c, ci) => {
      const cx = xs[r - 1][c] + (nd.dup ? (ci ? 10 : -10) : 0), cy = Y(r - 1);
      el(s, "path", { d: `M${x},${y + bh / 2} C${x},${y + bh} ${cx},${cy - bh} ${cx},${cy - bh / 2}`, style: `fill:none;stroke:${hex(nd.h) !== hex(L0[r][j].h) ? "var(--down)" : "var(--rule-strong)"};stroke-width:1.6;${nd.dup ? "stroke-dasharray:4 3" : ""}` });
    });
  });
  L.forEach((lv, r) => lv.forEach((nd, j) => {
    const chg = hex(nd.h) !== hex(L0[r][j].h), root = r === rows - 1;
    const g = el(s, "g", { class: "node", "data-r": r, "data-j": j, transform: `translate(${xs[r][j] - bw / 2},${Y(r) - bh / 2})` });
    el(g, "rect", { width: bw, height: bh, rx: 7, style: `fill:${chg ? "color-mix(in srgb, var(--down) 18%, var(--surface-1))" : root ? "color-mix(in srgb, var(--f-root) 18%, var(--surface-1))" : r === 0 ? "color-mix(in srgb, var(--btc) 12%, var(--surface-1))" : "var(--surface-1)"};stroke:${chg ? "var(--down)" : root ? "var(--f-root)" : "var(--rule-strong)"};stroke-width:1.4` });
    el(g, "text", { x: bw / 2, y: 14, "text-anchor": "middle", ...TX(10, "var(--muted)") }, r === 0 ? (nd.i === 0 ? "coinbase" : "tx " + nd.i) + (MK.bad.has(nd.i) ? " ✎" : "") : root ? "Merkle root" : "Hash(" + nd.kids.join(nd.dup ? "+" : ",") + ")");
    el(g, "text", { x: bw / 2, y: 27, "text-anchor": "middle", style: `font-family:var(--f-mono);font-size:10.5px;fill:${chg ? "var(--down)" : "var(--ink-1)"};font-weight:600` }, rhex(nd.h).slice(0, Math.max(4, Math.floor(bw / 8))));
  }));
  $("mkN").textContent = MK.n;
}
$("mk").addEventListener("click", e => {
  const g = e.target.closest(".node"); if (!g || +g.dataset.r !== 0) return;
  const j = +g.dataset.j; MK.bad.has(j) ? MK.bad.delete(j) : MK.bad.add(j); drawMerkle();
});
$("mk").addEventListener("mouseover", e => {
  const g = e.target.closest(".node"); if (!g) return focusMerkle([]);
  const r = +g.dataset.r, last = r === merkle(MK.n, MK.bad).length - 1;
  if (r === 0) focusMerkle(focusMerkle.find("foreach(const CTransaction", "push_back(tx.GetHash"));
  else if (last && r > 0) focusMerkle(focusMerkle.find("return (vMerkleTree"));
  else focusMerkle(focusMerkle.range(874, 882));
});
$("mk").addEventListener("mouseleave", () => focusMerkle([]));
$("mkPlus").onclick = () => { MK.n = Math.min(9, MK.n + 1); drawMerkle(); };
$("mkMinus").onclick = () => { MK.n = Math.max(1, MK.n - 1); [...MK.bad].forEach(i => i >= MK.n && MK.bad.delete(i)); drawMerkle(); };
$("mkHeal").onclick = () => { MK.bad.clear(); drawMerkle(); };

/* ================================================================ 6. script */
const PK = GENESIS.pubkey, PKH = "62e907b15cbf27d5425399ebf6f0fb50ebb88f18";
const OTHER_PK = "0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8", OTHER_PKH = "91b24bf9f5288532960ac687abb035127b1d28a5";
const VM = { tpl: "p2pkh", atk: "ok", k: 0, steps: [], timer: null };
const SNIP = { push: "src-op-push", sep: "src-op-sep", dup: "src-op-dup", hash: "src-op-hash", eqv: "src-op-eqv", sig: "src-op-sig" };
function vmProgram() {
  const pk = VM.atk === "key" ? OTHER_PK : PK;
  const sig = { t: "data", v: VM.atk === "ok" ? "<sig by Satoshi's key>" : VM.atk === "key" ? "<sig by another key>" : "<forged sig>", from: "scriptSig" };
  const pub = { t: "data", v: short(pk), full: pk, from: "scriptSig" };
  const sep = { t: "sep", v: "OP_CODESEPARATOR", from: "joined by VerifySignature" };
  if (VM.tpl === "p2pk") return [sig, sep, { t: "data", v: short(PK), from: "scriptPubKey" }, { t: "op", v: "OP_CHECKSIG", from: "scriptPubKey" }];
  return [sig, pub, sep, { t: "op", v: "OP_DUP", from: "scriptPubKey" }, { t: "op", v: "OP_HASH160", from: "scriptPubKey" },
    { t: "data", v: short(PKH), from: "scriptPubKey" }, { t: "op", v: "OP_EQUALVERIFY", from: "scriptPubKey" }, { t: "op", v: "OP_CHECKSIG", from: "scriptPubKey" }];
}
function vmRun() {
  const P = vmProgram(), st = [], steps = [{ pc: -1, stack: [], say: VM.tpl === "p2pk"
    ? "<b>Pay-to-pubkey</b>, the form block 0's reward uses: the output holds Satoshi's public key followed by OP_CHECKSIG. Press Step."
    : "<b>Pay-to-pubkey-hash</b>, the form behind ordinary addresses: the output holds only a 20-byte hash of the key (" + PKH.slice(0, 8) + "… is Satoshi's address 1A1zP1eP…). Press Step.", snip: "push", lines: [] }];
  let halted = false;
  P.forEach((o, pc) => {
    if (halted) return;
    let say = "", snip = "push", find = [];
    if (o.t === "data") { st.push({ v: o.v, full: o.full }); say = `Push data <b>${esc(o.v)}</b> onto the stack.`; find = ["stack.push_back(vchPushValue)", "opcode <= OP_PUSHDATA4"]; }
    else if (o.t === "sep") { say = "<b>OP_CODESEPARATOR</b> marks where the signed part of the script begins. VerifySignature inserts it between the two halves."; snip = "sep"; find = ["pbegincodehash = pc"]; }
    else if (o.v === "OP_DUP") { const top = st[st.length - 1]; st.push({ ...top }); say = "<b>OP_DUP</b> copies the top item: now there are two copies of the public key."; snip = "dup"; find = ["valtype vch = stacktop(-1)", "stack.push_back(vch)"]; }
    else if (o.v === "OP_HASH160") { const top = st.pop(); const h = top.full === OTHER_PK ? OTHER_PKH : PKH; st.push({ v: short(h), full: h }); say = `<b>OP_HASH160</b> replaces the key with RIPEMD-160(SHA-256(key)) = <span class="mono">${h.slice(0, 12)}…</span>`; snip = "hash"; find = ["Hash160(vch)", "memcpy(&vchHash[0], &hash160", "stack.push_back(vchHash)"]; }
    else if (o.v === "OP_EQUALVERIFY") {
      const b = st.pop(), a = st.pop(), eq = a.full === b.full;
      if (eq) say = "<b>OP_EQUALVERIFY</b>: the two hashes match, so the key the spender supplied is the one the coin was locked to. Both are popped and execution continues.";
      else { st.push({ v: "false", f: true }); halted = true; say = "<b>OP_EQUALVERIFY</b>: the hashes <b>don't match</b>. This key isn't the one the coin was locked to. <code>pc = pend</code> jumps to the end with <i>false</i> on the stack."; }
      snip = "eqv"; find = ["bool fEqual = (vch1 == vch2)", eq ? "stack.pop_back();" : "pc = pend", "stack.push_back(fEqual"];
    } else if (o.v === "OP_CHECKSIG") {
      st.pop(); st.pop();
      const good = VM.atk === "ok";
      st.push(good ? { v: "true", t: true } : { v: "false", f: true });
      say = good ? "<b>OP_CHECKSIG</b> pops the key and the signature and checks the ECDSA signature against this transaction's hash. It is valid, so it pushes <i>true</i>."
        : "<b>OP_CHECKSIG</b> checks the signature against the key. It doesn't verify, so it pushes <i>false</i>.";
      snip = "sig"; find = ["bool fSuccess = CheckSig", "stack.push_back(fSuccess"];
    }
    steps.push({ pc, stack: st.map(x => ({ ...x })), say, snip, find });
  });
  const top = steps[steps.length - 1].stack.slice(-1)[0];
  steps[steps.length - 1].end = top && top.t ? "ok" : "bad";
  VM.steps = steps; VM.prog = P;
}
let opFocus = null, opSnip = null;
function vmRender() {
  const s = VM.steps[VM.k];
  $("prog").innerHTML = VM.prog.map((o, i) => `<span class="op ${o.t === "data" ? "data" : o.t === "sep" ? "sep" : ""}${i < s.pc ? " done" : ""}${i === s.pc ? " cur" : ""}"><span class="from">${o.from}</span>${esc(o.v)}</span>`).join("");
  $("stackcol").innerHTML = s.stack.map(x => `<div class="item${x.t ? " t" : x.f ? " f" : ""}">${esc(x.v)}</div>`).join("") || `<span class="hint" style="text-align:center;margin:auto">empty</span>`;
  $("explain").innerHTML = s.say;
  $("vmResult").innerHTML = s.end === "ok" ? `<span class="ok">✓ Script ends with true: the coin can be spent.</span>` : s.end === "bad" ? `<span class="bad">✗ Script ends with false: the spend is rejected.</span>` : "";
  if (opSnip !== s.snip) { opSnip = s.snip; opFocus = codePane($("codeOp"), SNIP[s.snip]); }
  opFocus(s.find ? opFocus.find(...s.find) : []);
  $("vmBack").disabled = VM.k === 0; $("vmStep").disabled = VM.k === VM.steps.length - 1;
}
function vmReset() { clearInterval(VM.timer); VM.timer = null; $("vmRun").textContent = "▶ Run"; vmRun(); VM.k = 0; vmRender(); }
$("tplSeg").innerHTML = `<button type="button" data-v="p2pkh">Pay to address</button><button type="button" data-v="p2pk">Pay to public key</button>`;
$("atkSeg").innerHTML = `<button type="button" data-v="ok">Honest</button><button type="button" data-v="sig">Forged signature</button><button type="button" data-v="key">Wrong key</button>`;
const segSync = () => {
  document.querySelectorAll("#tplSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === VM.tpl));
  document.querySelectorAll("#atkSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === VM.atk));
};
$("tplSeg").onclick = e => { const b = e.target.closest("button"); if (b) { VM.tpl = b.dataset.v; segSync(); vmReset(); } };
$("atkSeg").onclick = e => { const b = e.target.closest("button"); if (b) { VM.atk = b.dataset.v; segSync(); vmReset(); } };
$("vmStep").onclick = () => { if (VM.k < VM.steps.length - 1) { VM.k++; vmRender(); } };
$("vmBack").onclick = () => { if (VM.k > 0) { VM.k--; vmRender(); } };
$("vmReset").onclick = vmReset;
$("vmRun").onclick = () => {
  if (VM.timer) { clearInterval(VM.timer); VM.timer = null; $("vmRun").textContent = "▶ Run"; return; }
  if (VM.k === VM.steps.length - 1) VM.k = 0;
  $("vmRun").textContent = "❚❚ Pause";
  VM.timer = setInterval(() => { if (VM.k >= VM.steps.length - 1) { clearInterval(VM.timer); VM.timer = null; $("vmRun").textContent = "▶ Run"; return; } VM.k++; vmRender(); }, 1300);
};
panes["src-verify"](panes["src-verify"].find("return EvalScript"));

/* ================================================================ 7. difficulty */
const DAY = 86400, TT = 14 * DAY, LIMIT = 0x1d00ffff, OLD = 0x1c3fffc0;
function setCompact(b) { const n = b >>> 24, m = BigInt(b & 0x7fffff); return n <= 3 ? m >> BigInt(8 * (3 - n)) : m << BigInt(8 * (n - 3)); }
function getCompact(v) {
  let size = Math.ceil(v.toString(16).length / 2);
  let m = Number(size <= 3 ? v << BigInt(8 * (3 - size)) : v >> BigInt(8 * (size - 3)));
  if (m & 0x800000) { m >>= 8; size++; }
  return ((size << 24) | m) >>> 0;
}
const h8 = b => "0x" + b.toString(16).padStart(8, "0");
const focusRet = panes["src-retarget"];
function drawDiff() {
  const days = +$("span").value, act = days * DAY;
  const cl = Math.min(TT * 4, Math.max(TT / 4, act)), clamped = cl !== act;
  let nw = setCompact(OLD) * BigInt(cl) / BigInt(TT), capped = false;
  if (nw > setCompact(LIMIT)) { nw = setCompact(LIMIT); capped = true; }
  const nb = getCompact(nw), oldT = Number(setCompact(OLD)), newT = Number(setCompact(nb)), lim = Number(setCompact(LIMIT));
  const ratio = oldT / newT;
  $("dAct").textContent = days.toFixed(1) + " days";
  $("dClamp").textContent = (cl / DAY).toFixed(1) + " days";
  $("dChg").innerHTML = ratio > 1.0005 ? `<span class="bad">${ratio.toFixed(2)}× harder</span>` : ratio < .9995 ? `<span class="ok">${(1 / ratio).toFixed(2)}× easier</span>` : "unchanged";
  const pos = d => Math.min(100, d / 70 * 100);
  $("clamp").style.setProperty("--a", pos(3.5) + "%"); $("clamp").style.setProperty("--b", pos(56) + "%");
  $("clamp").innerHTML = `<div class="track"></div>
    <div class="mk2" style="left:${pos(3.5)}%"><span>3.5 d (÷4)</span></div><div class="mk2" style="left:${pos(14)}%"><span>14 d target</span></div><div class="mk2" style="left:${pos(56)}%"><span>56 d (×4)</span></div>
    <div class="dot${clamped ? " cl" : ""}" style="left:${pos(days)}%"></div>`;
  $("tbars").innerHTML = [["before", OLD, oldT, "--muted"], ["after", nb, newT, ratio > 1 ? "--down" : "--up"], ["floor", LIMIT, lim, "--rule-strong"]].map(([lb, b, t, c]) =>
    `<div class="tbar"><span>${lb === "floor" ? "easiest allowed" : "target " + lb}</span><span class="tr"><span style="width:${Math.max(1, t / lim * 100)}%;--c:var(${c})"></span></span><span class="nb">nBits ${h8(b)}</span></div>`).join("");
  $("dNote").innerHTML = `A bigger target is easier to hit. Blocks came ${days < 14 ? "<b>faster</b> than every 10 minutes, so the target shrinks" : days > 14 ? "<b>slower</b> than every 10 minutes, so the target grows" : "exactly on time"}` +
    (clamped ? `. The change is capped at 4×, so ${days.toFixed(1)} days counts as ${(cl / DAY).toFixed(1)}.` : ".") +
    (capped ? ` It also can't go easier than <code>bnProofOfWorkLimit</code> (nBits 0x1d00ffff), the genesis difficulty.` : "") +
    ` The example starts from nBits ${h8(OLD)}, 4× harder than block 0.`;
  const L = [...focusRet.find("nActualTimespan = pindexLast->nTime"), ...focusRet.range(714, 717)];
  if (act < TT / 4) L.push(...focusRet.find("nActualTimespan < nTargetTimespan/4", "nActualTimespan = nTargetTimespan/4"));
  if (act > TT * 4) L.push(...focusRet.find("nActualTimespan > nTargetTimespan*4", "nActualTimespan = nTargetTimespan*4"));
  if (capped) L.push(...focusRet.find("if (bnNew > bnProofOfWorkLimit)", "bnNew = bnProofOfWorkLimit"));
  focusRet(L);
}
$("span").addEventListener("input", drawDiff);

/* ================================================================ 8. halving */
const COIN = 100000000n, ERA = 210000;
const ERA_YEAR = k => [2009.0, 2012.91, 2016.52, 2020.36, 2024.3][k] ?? 2024.3 + 4 * (k - 4);
const supplyAt = era => { let s = 0n; for (let k = 0; k < era; k++) s += BigInt(ERA) * ((50n * COIN) >> BigInt(k)); return s; };
const TOTAL_SAT = supplyAt(64);
const btc = sat => (Number(sat) / 1e8).toLocaleString("en-US", { maximumFractionDigits: 8 });
const focusSub = panes["src-subsidy"];
function drawHalving() {
  const hgt = +$("height").value, era = Math.floor(hgt / ERA), sub = era < 64 ? (50n * COIN) >> BigInt(era) : 0n;
  $("hHeight").textContent = fmt(hgt);
  $("hEra").textContent = `nBestHeight / 210000 = ${era} · around ${Math.floor(ERA_YEAR(era) + (hgt % ERA) / ERA * 4)}${era > 4 ? " (est.)" : ""}`;
  const base = (50n * COIN).toString(2), W = base.length, cur = sub.toString(2).padStart(W, "0");
  const row = (bits, mark) => `<div class="bits">${[...bits].map((b, i) => `<span class="${b === "1" ? "one" : ""}${mark && i < era ? " gone" : ""}">${b}</span>`).join("")}</div>`;
  $("shift").innerHTML = `<div class="lbl">50 * COIN = ${fmt(Number(50n * COIN))} satoshis, in binary</div>${row(base)}
    <div class="lbl">nSubsidy &gt;&gt;= ${era} → <b style="color:var(--ink-1)">${fmt(Number(sub))}</b> satoshis = <b style="color:var(--ink-1)">${btc(sub)} BTC</b> per block</div>${row(cur, true)}`;
  // supply curve
  const host = $("supply"), w = host.clientWidth, h = host.clientHeight, s = svgIn(host, w, h);
  const P = { l: 6, r: 44, t: 12, b: 22 }, x0 = 2009, x1 = 2141;
  const X = y => P.l + (w - P.l - P.r) * (y - x0) / (x1 - x0), Y = v => P.t + (h - P.t - P.b) * (1 - v / 21e6);
  for (const v of [0, 7e6, 14e6, 21e6]) { el(s, "line", { x1: P.l, x2: w - P.r, y1: Y(v), y2: Y(v), style: "stroke:var(--grid)" }); el(s, "text", { x: w - P.r + 6, y: Y(v) + 4, ...TX(10.5) }, v / 1e6 + "M"); }
  for (const y of [2009, 2020, 2040, 2060, 2080, 2100, 2120, 2140]) el(s, "text", { x: X(y), y: h - 5, "text-anchor": "middle", ...TX(10.5) }, y);
  let d = `M${X(ERA_YEAR(0))},${Y(0)}`;
  for (let k = 0; k < 34; k++) { const yA = ERA_YEAR(k), yB = ERA_YEAR(k + 1); d += ` L${X(yB)},${Y(Number(supplyAt(k + 1)) / 1e8)}`; }
  el(s, "path", { d, style: "fill:none;stroke:var(--btc);stroke-width:2.2" });
  for (let k = 1; k <= 4; k++) el(s, "line", { x1: X(ERA_YEAR(k)), x2: X(ERA_YEAR(k)), y1: P.t, y2: h - P.b, style: "stroke:var(--btc);stroke-dasharray:2 4;opacity:.5" });
  const yNow = ERA_YEAR(era) + (hgt % ERA) / ERA * (ERA_YEAR(era + 1) - ERA_YEAR(era)), supNow = Number(supplyAt(era) + BigInt(hgt % ERA) * sub) / 1e8;
  el(s, "circle", { cx: X(yNow), cy: Y(supNow), r: 5.5, style: "fill:var(--btc);stroke:var(--surface-1);stroke-width:2" });
  el(s, "text", { x: Math.min(w - P.r - 4, X(yNow) + 9), y: Y(supNow) + 16, "text-anchor": X(yNow) > w - 160 ? "end" : "start", ...TX(11.5, "var(--ink-1)", "font-weight:600") }, `${(supNow / 1e6).toFixed(2)}M mined`);
  focusSub(focusSub.find("nSubsidy = 50 * COIN", "Subsidy is cut in half", "nSubsidy >>= "));
}
$("height").addEventListener("input", drawHalving);
$("supNote").innerHTML = `Add up every block's reward and the total is <b>${btc(TOTAL_SAT)} BTC</b>, just under 21 million, because shifting right drops the fractions. The comment says “every 4 years” but the code counts blocks: 210,000 blocks at 10 minutes each is about 4 years.
  <br><br><b>A bug hiding in this line:</b> in C++, shifting a 64-bit number by 64 or more is undefined. On ordinary PCs the shift count wraps around, so in about the year 2214 (height 13,440,000) the reward would have jumped back to 50 BTC. BIP 42 fixed it in 2014.`;

/* ================================================================ 9. longest chain */
const FK = { blocks: [], best: null, log: [] };
const focusChain = panes["src-chain"];
function forkReset() {
  FK.blocks = [{ id: "0", h: 0, row: 0 }, { id: "1", h: 1, row: 0, p: "0" }, { id: "2", h: 2, row: 0, p: "1" }, { id: "3a", h: 3, row: -1, p: "2" }, { id: "3b", h: 3, row: 1, p: "2" }];
  FK.best = "3a";
  FK.fresh = 1;
  FK.log = ["Two miners found block 3 within seconds of each other. Your node saw 3a first, so 3a is its best chain. 3b is stored, but not used."];
  focusChain([]); drawForks();
}
const fb = id => FK.blocks.find(b => b.id === id);
function chainOf(id) { const s = new Set(); for (let b = fb(id); b; b = b.p ? fb(b.p) : null) s.add(b.id); return s; }
function mineOn(row) {
  const tip = FK.blocks.filter(b => b.row === row).sort((a, b) => b.h - a.h)[0];
  const nb = { id: (tip.h + 1) + (row < 0 ? "a" : "b"), h: tip.h + 1, row, p: tip.id };
  FK.blocks.push(nb);
  const best = fb(FK.best), F = focusChain;
  if (nb.h > best.h) {
    if (nb.p === FK.best) {
      FK.best = nb.id;
      FK.log = [...[`Block ${nb.id} extends the best chain: ConnectBlock(), height ${nb.h}.`], ...FK.log].slice(0, 7); FK.fresh = 1;
      F([...F.find("if (pindexNew->nHeight > nBestHeight)", "else if (hashPrevBlock == hashBestChain)", "ConnectBlock(txdb, pindexNew)"), ...F.range(1132, 1135)]);
    } else {
      const oldC = chainOf(FK.best), newC = chainOf(nb.id);
      const dis = [...oldC].filter(x => !newC.has(x)), con = [...newC].filter(x => !oldC.has(x)).reverse();
      FK.best = nb.id;
      FK.log = [...[`Block ${nb.id} makes the other branch longer (height ${nb.h} > ${best.h}): Reorganize().`,
        `  disconnect ${dis.join(", ")}: their transactions go back to the memory pool`,
        `  connect ${con.join(", ")}`, `  best chain is now …${[...newC].reverse().slice(-4).join(" → ")}`], ...FK.log].slice(0, 7); FK.fresh = 4;
      F([...F.find("if (pindexNew->nHeight > nBestHeight)", "New best branch", "Reorganize(txdb, pindexNew)"), ...F.range(1132, 1135)]);
    }
  } else {
    FK.log = [...[`Block ${nb.id} ties the best chain at height ${nb.h}. It's stored, but nHeight > nBestHeight is false, so your node keeps the branch it saw first.`], ...FK.log].slice(0, 7); FK.fresh = 1;
    F(F.find("if (pindexNew->nHeight > nBestHeight)"));
  }
  drawForks();
}
function drawForks() {
  const maxH = Math.max(...FK.blocks.map(b => b.h)), bw = 58, gap = 26, W = Math.max($("forks").clientWidth, 20 + (maxH + 1) * (bw + gap)), H = 210;
  const s = svgIn($("forks"), W, H); s.setAttribute("width", W); s.setAttribute("height", H);
  const X = h => 10 + h * (bw + gap), Y = r => H / 2 + r * 64 - 20;
  const on = chainOf(FK.best);
  FK.blocks.forEach(b => {
    if (!b.p) return; const p = fb(b.p), act = on.has(b.id);
    el(s, "path", { d: `M${X(p.h) + bw},${Y(p.row) + 20} C${X(p.h) + bw + 16},${Y(p.row) + 20} ${X(b.h) - 16},${Y(b.row) + 20} ${X(b.h)},${Y(b.row) + 20}`, style: `fill:none;stroke:${act ? "var(--ink-2)" : "var(--rule-strong)"};stroke-width:${act ? 2 : 1.4};${act ? "" : "stroke-dasharray:4 3"}` });
  });
  FK.blocks.forEach(b => {
    const act = on.has(b.id), c = b.row < 0 ? "var(--btc)" : b.row > 0 ? "var(--m-script)" : "var(--ink-2)";
    const g = el(s, "g", { transform: `translate(${X(b.h)},${Y(b.row)})`, style: `opacity:${act ? 1 : .45};transition:opacity .3s` });
    el(g, "rect", { width: bw, height: 40, rx: 8, style: `fill:${act ? `color-mix(in srgb, ${c} 18%, var(--surface-1))` : "var(--surface-1)"};stroke:${c};stroke-width:${b.id === FK.best ? 2.6 : 1.4}` });
    el(g, "text", { x: bw / 2, y: 17, "text-anchor": "middle", ...TX(12.5, "var(--ink-1)", "font-weight:700") }, b.id === "0" ? "Gen." : b.id);
    el(g, "text", { x: bw / 2, y: 31, "text-anchor": "middle", ...TX(9.5) }, "h=" + b.h);
    if (b.id === FK.best) el(g, "text", { x: bw / 2, y: -7, "text-anchor": "middle", ...TX(10.5, "var(--ink-1)", "font-weight:700") }, "best ▾");
  });
  el(s, "text", { x: 10, y: 14, ...TX(11) }, "solid = the chain your node uses · faded = stored side branch");
  $("blog").innerHTML = FK.log.map((l, i) => `<div${i < FK.fresh ? ' class="new"' : ""}>${esc(l).replace(/^ {2}/, "&nbsp;&nbsp;→ ")}</div>`).join("");
}
$("mineA").onclick = () => mineOn(-1);
$("mineB").onclick = () => mineOn(1);
$("forkReset").onclick = forkReset;

/* ================================================================ boot */
fileInfo("main.cpp");
drawTreemap(); fileInfo(tmSel);
txCards();
drawHeadline();
drawMerkle();
segSync(); vmReset();
drawDiff();
drawHalving();
forkReset();
let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { drawTreemap(); txLinks(); drawMerkle(); drawHalving(); drawForks(); }, 120); });
})();
