/* 泡泡存档 —— 主逻辑
   纯前端单机应用：文字和缩略图存本地 IndexedDB，原图/原视频上传 Google Drive
*/
(function () {
  const APP_VERSION = "v1.4.4";
  "use strict";

  /* ---------------- 小工具 ---------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID().slice(0, 13) : Math.random().toString(36).slice(2, 12));
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // 云端文件 id 可能在消息顶层，也可能在 media 里（兼容导入的备份）
  const driveIdOf = (m) => (m && (m.driveId || (m.media && m.media.driveId))) || "";
  const pad = (n) => String(n).padStart(2, "0");

  const ICON = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17.5 18h-11a4 4 0 0 1-.6-8 5.4 5.4 0 0 1 10.4-.6A3.8 3.8 0 0 1 17.5 18z"/></svg>',
    cloudOk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 17h-11a3.8 3.8 0 0 1-.6-7.6 5.2 5.2 0 0 1 10-.6A3.6 3.6 0 0 1 17.5 17z"/><path d="m9.6 12.6 1.8 1.8 3.4-3.4"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m14.5 5-6.5 7 6.5 7"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="10.5" width="16" height="10" rx="3"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 4.6v14.8c0 .9 1 1.4 1.7.9l11-7.4c.7-.5.7-1.4 0-1.8L8.7 3.7C8 3.2 7 3.7 7 4.6z"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m4.5 17 5-5 4 4 3-2.5 4 3.5"/></svg>',
    film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M8 4.5v15M16 4.5v15M3.5 9.5h4.5M16 9.5h4.5M3.5 14.5h4.5M16 14.5h4.5"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.2 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.2 5.9-.9z"/></svg>',
    starFill: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.2 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.2 5.9-.9z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 5.5h-9a2 2 0 0 0-2 2v9"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l.8 13h9.4l.8-13"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4.5 19.5h3l10-10-3-3-10 10z"/><path d="m14.5 6.5 3 3"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3.1 1.9"/></svg>',
    lang: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.6"/><path d="M3.6 12h16.8M12 3.4c2.6 2.6 2.6 14.6 0 17.2M12 3.4c-2.6 2.6-2.6 14.6 0 17.2"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 4v10m0 0 4-4m-4 4-4-4M5 18.5h14"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 4h6v6"/><path d="M20 4 10.5 13.5"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>',
    bubble: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M20.5 11.2c0 3.9-3.8 7-8.5 7-1 0-2-.1-2.9-.4L4.5 20.5l1.3-3.3A6.7 6.7 0 0 1 3.5 11.2c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7z"/></svg>',
    wave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12h2l2-5 2 10 2-7 2 4 2-2h4"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m5 12.5 5 5 9-11"/></svg>',
  };

  const GRAD = ["#8f7cff,#6a4ee6", "#f08bb4,#e0658f", "#63c6b0,#2f9c88", "#f3b25d,#dd8b2a", "#79a8f5,#4a72de", "#c48bf0,#9a55d6"];
  const colorOf = (s) => GRAD[Math.abs([...String(s || "?")].reduce((a, c) => a + c.charCodeAt(0), 0)) % GRAD.length];

  function toast(msg, ms) {
    const el = $("#toast");
    const sheetOpen = $("#sheetWrap") && !$("#sheetWrap").hidden;
    el.classList.toggle("top", !!sheetOpen);
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), ms || 2000);
  }

  /* ---------------- 时间格式 ---------------- */
  const WD = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const d2 = (s) => new Date(s);
  function dayKey(s) {
    const d = d2(s);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function fmtClock(s) {
    const d = d2(s);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fmtDayLabel(s) {
    const d = d2(s);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${WD[d.getDay()]}`;
  }
  function fmtListTime(s) {
    const d = d2(s);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return fmtClock(s);
    const y = new Date(now.getTime() - 86400000);
    if (d.toDateString() === y.toDateString()) return "昨天";
    if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}-${pad(d.getDate())}`;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function fmtSize(n) {
    if (!n) return "0 B";
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }
  function fmtDur(sec) {
    if (!sec || !isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${pad(s)}`;
  }

  /* ---------------- 全局状态 ---------------- */
  const DEFAULTS = {
    clientId: "",
    rootFolderId: "",
    thumbMax: 420,
    quality: 0.82,
    lastDate: "",
    monthFolders: {},
    demoSeeded: false,
    showZh: true,
  };
  const S = {
    view: "home",
    artists: [],
    meta: {},
    msgs: [],
    artist: null,
    q: "",
    onlyStar: false,
    settings: { ...DEFAULTS },
    pending: 0,
  };
  const urls = new Map();
  function clearUrls() {
    for (const [k, u] of urls) {
      if (k.startsWith("av") || k.startsWith("tmpav")) continue;
      URL.revokeObjectURL(u);
      urls.delete(k);
    }
  }
  const asBlob = (b) => (b instanceof Blob ? b : null);
  function stripMedia(m) {
    return {
      ...m,
      media: m.media
        ? {
            thumb: null,
            full: null,
            name: m.media.name,
            mime: m.media.mime,
            size: m.media.size,
            w: m.media.w,
            h: m.media.h,
            duration: m.media.duration,
            waves: m.media.waves,
          }
        : null,
    };
  }

  function blobUrl(key, blob) {
    if (!blob) return "";
    if (urls.has(key)) return urls.get(key);
    const u = URL.createObjectURL(blob);
    urls.set(key, u);
    return u;
  }

  /* ---------------- 启动 ---------------- */
  async function boot() {
    S.settings = { ...DEFAULTS, ...(await DB.kvGet("settings", {})) };
    Drive.setClientId(S.settings.clientId);
    try {
      if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
    } catch (e) {}

    bindGlobal();
    await reloadAll();
    renderHome();

    const params = new URLSearchParams(location.search);
    if (params.get("demo") === "1" && !S.settings.demoSeeded) await seedDemo();
    await reloadAll();
    renderHome();
    updateSyncBadge();

    if (params.get("demo") === "1" && params.get("view") === "chat" && S.artists[0]) {
      openChat(S.artists[0].id);
    }
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker
        .register("sw.js", { updateViaCache: "none" })
        .then((reg) => {
          reg.update().catch(() => {});
          setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
        })
        .catch(() => {});
    }
  }

  async function reloadAll() {
    const [artists, messages] = await Promise.all([DB.all("artists"), DB.all("messages")]);
    S.artists = artists;
    S.msgsAll = messages;
    const meta = {};
    artists.forEach((a) => (meta[a.id] = { lastAt: null, lastText: "", count: 0, firstAt: null }));
    messages.forEach((m) => {
      const meta1 = meta[m.artistId];
      if (!meta1) return;
      meta1.count++;
      if (!meta1.firstAt || m.sentAt < meta1.firstAt) meta1.firstAt = m.sentAt;
      if (!meta1.lastAt || m.sentAt > meta1.lastAt) {
        meta1.lastAt = m.sentAt;
        meta1.lastText = previewOf(m);
      }
    });
    S.meta = meta;
    // 待上传 = 本地还有原文件、且云端还没有
    S.pending = messages.filter((m) => m.media && m.media.full && !driveIdOf(m)).length;
  }

  function previewOf(m) {
    const t = m.textZh || m.text || "";
    if (m.type === "image") return "[图片]" + (t ? " " + t : "");
    if (m.type === "video") return "[视频]" + (t ? " " + t : "");
    if (m.type === "voice") return "[语音]" + (t ? " " + t : "");
    return t;
  }

  /* ---------------- 首页 ---------------- */
  function renderHome() {
    if (S.view !== "home") return;
    const list = $("#chatList");
    const q = S.q.trim().toLowerCase();
    let artists = S.artists.slice();
    if (q) {
      artists = artists.filter((a) => {
        if (a.name.toLowerCase().includes(q)) return true;
        return S.msgsAll.some((m) => m.artistId === a.id && ((m.text || "") + " " + (m.textZh || "")).toLowerCase().includes(q));
      });
    }
    artists.sort((a, b) => {
      const am = S.meta[a.id] || {};
      const bm = S.meta[b.id] || {};
      return (bm.lastAt || b.createdAt || "").localeCompare(am.lastAt || a.createdAt || "");
    });

    const total = S.msgsAll.length;
    $("#summary").textContent = total
      ? `${S.artists.length} 位 · ${total} 条存档${S.pending ? ` · ${S.pending} 待同步` : ""}`
      : "把喜欢的内容，留在这里";

    list.innerHTML =
      artists
        .map((a) => {
          const m = S.meta[a.id] || { count: 0, lastText: "", lastAt: null };
          return `<article class="chat-item" data-id="${esc(a.id)}">
        <div class="avatar s52 ring" style="background:linear-gradient(150deg,${colorOf(a.name)})">
          ${a.avatarThumb ? `<img src="${blobUrl("av" + a.id, a.avatarThumb)}" alt="">` : esc((a.name || "?").slice(0, 1))}
        </div>
        <div class="ci-body">
          <div class="ci-top"><span class="ci-name">${esc(a.name)}</span>${
            a.group ? `<span class="ci-group">${esc(a.group)}</span>` : ""
          }<span class="ci-time">${m.lastAt ? fmtListTime(m.lastAt) : ""}</span></div>
          <div class="ci-sub"><span class="ci-last">${esc(m.lastText || "还没有内容")}</span>${
            m.count ? `<span class="ci-count">${m.count} 条</span>` : ""
          }</div>
        </div>
      </article>`;
        })
        .join("") +
      `<button class="add-artist" id="btnAddArtist">${ICON.plus}<span>新建一位艺人</span></button>`;

    $("#homeEmpty").hidden = artists.length > 0;
  }

  /* ---------------- 对话页 ---------------- */
  async function openChat(artistId, opts = {}) {
    const artist = S.artists.find((a) => a.id === artistId);
    if (!artist) return;
    S.artist = artist;
    S.onlyStar = false;
    await loadChatMsgs();
    S.view = "chat";
    $("#view-home").hidden = true;
    $("#view-settings").hidden = true;
    $("#view-chat").hidden = false;
    renderChatHeader();
    renderChat(true);
    if (!opts.fromPop) history.pushState({ chat: artistId }, "");
  }

  async function loadChatMsgs() {
    const all = await DB.byIndex("messages", "artistId", S.artist.id);
    S.msgs = all.sort((a, b) => (a.sentAt || "").localeCompare(b.sentAt || "") || a.createdAt.localeCompare(b.createdAt));
  }

  function renderChatHeader() {
    const a = S.artist;
    $("#chatHead").innerHTML = `
      <div style="min-width:0">
        <div class="ch-name">${esc(a.name)}</div>
        <div class="ch-sub">${a.group ? esc(a.group) + " · " : ""}${S.msgs.length} 条存档${
      S.onlyStar ? " · 只看收藏" : ""
    }</div>
      </div>`;
  }

  function mediaHTML(m) {
    const med = m.media || {};
    const thumb = asBlob(med.thumb);
    if ((m.type === "image" || m.type === "video") && !thumb) {
      // 导入备份后没有缩略图：给一个可点击的云端占位
      return `<button class="thumb" data-act="open" style="aspect-ratio:1/1.15;width:190px;display:grid;place-items:center;background:#eceef5">
        <span style="font-size:11.5px;color:#8a8fa3;line-height:1.5;text-align:center">${driveIdOf(m) ? "云端原图<br>点开查看" : "原文件<br>点开查看"}</span></button>`;
    }
    if (m.type === "image") {
      const src = blobUrl("t" + m.id, thumb);
      const ar = med.w && med.h ? clamp(med.h / med.w, 0.55, 1.9) : 1.15;
      return `<button class="thumb" data-act="open" style="aspect-ratio:1/${ar.toFixed(2)};width:220px">
        <img src="${src}" alt="" loading="lazy"></button>`;
    }
    if (m.type === "video") {
      const src = blobUrl("t" + m.id, thumb);
      const ar = med.w && med.h ? clamp(med.h / med.w, 0.55, 1.9) : 1.15;
      return `<button class="thumb" data-act="open" style="aspect-ratio:1/${ar.toFixed(2)};width:220px">
        <img src="${src}" alt="" loading="lazy">
        <span class="play"><span>${ICON.play}</span></span>
        ${med.duration ? `<span class="dur">${fmtDur(med.duration)}</span>` : ""}
      </button>`;
    }
    if (m.type === "voice") {
      const bars = (med.waves || [3, 7, 5, 9, 4, 8, 6, 10, 5, 7, 3, 6]).map((h) => `<i style="height:${h * 2}px"></i>`).join("");
      return `<div class="voice-row"><button class="vbtn" data-act="open">${ICON.play}</button><div class="wave">${bars}</div><span class="vtime">${fmtDur(
        med.duration
      )}</span></div>`;
    }
    return "";
  }

  function msgHTML(m, showHead) {
    const side = m.role === "me" ? "right" : "left";
    const cls = m.role === "me" ? "me" : "artist";
    const isMedia = m.type !== "text";
    const sync = isMedia
      ? driveIdOf(m)
        ? `<span class="sync ok">${ICON.cloudOk}</span>`
        : m.syncState === "pending"
        ? `<span class="sync pending">${ICON.cloud}</span>`
        : ""
      : "";
    const star = m.starred ? `<span class="star">${ICON.starFill}</span>` : "";
    const showZh = S.settings.showZh !== false;
    const raw = (m.text || "").trim();
    const zh = (m.textZh || "").trim();
    let inner = "";
    if (raw) inner += `<div class="txt">${esc(raw)}</div>`;
    if (zh && showZh) {
      inner += raw ? `<div class="zh">${esc(zh)}</div>` : `<div class="txt">${esc(zh)}</div>`;
    }
    const textHTML = inner ? `<div class="${isMedia ? "cap" : ""}">${inner}</div>` : "";
    const q = m.quote;
    const quoteHTML =
      q && q.text
        ? `<div class="quote"><div class="q-head">${
            q.type === "me" ? "回复给 " + esc(q.name || "我") : "ARTIST的回复"
          }</div><div class="q-txt">${esc(q.text)}</div>${
            q.textZh && showZh ? `<div class="q-zh">${esc(q.textZh)}</div>` : ""
          }</div><div class="q-line"></div>`
        : "";
    const a = S.artist || {};
    const avHTML =
      side === "left"
        ? `<div class="row-av"><span class="av-in" style="background:linear-gradient(150deg,${colorOf(a.name || "")})">${
            a.avatarThumb
              ? `<img src="${blobUrl("av" + a.id, a.avatarThumb)}" alt="">`
              : esc((a.name || "?").slice(0, 1))
          }</span></div>`
        : "";
    const nameHTML =
      side === "left" && showHead
        ? `<div class="row-label"><span class="badge-artist">ARTIST</span><span class="lb-name">${esc(
            a.name || ""
          )}</span></div>`
        : "";
    return `<div class="row ${side}">
      ${avHTML}
      <div class="row-body" data-msg="${esc(m.id)}">
        ${nameHTML}
        <div class="bubble-line">
          <div class="bubble ${cls} ${isMedia ? "media" : ""}${quoteHTML ? " has-quote" : ""}">${
          isMedia ? mediaHTML(m) : ""
        }${quoteHTML}${textHTML}</div>
          <div class="row-meta"><span>${fmtClock(m.sentAt)}</span>${star}${sync}</div>
        </div>
      </div>
    </div>`;
  }

  function renderChat(scrollBottom) {
    clearUrls();
    const vm = $("#msgList");
    const prevTop = vm.scrollTop;
    const list = S.onlyStar ? S.msgs.filter((m) => m.starred) : S.msgs;
    let html = "";
    let lastDay = "";
    list.forEach((m) => {
      const k = dayKey(m.sentAt);
      if (k !== lastDay) {
        html += `<div class="day-pill">${fmtDayLabel(m.sentAt)}</div>`;
        lastDay = k;
      }
      html += msgHTML(m, m.role !== "me");
    });
    if (!list.length) {
      html = `<div class="empty"><span class="em-ico">${S.onlyStar ? "★" : "🫧"}</span>${
        S.onlyStar ? "还没有收藏的内容" : "还没有存档<br>点右下角 + 添加第一条"
      }</div>`;
    }
    vm.innerHTML = html;
    vm.scrollTop = scrollBottom ? vm.scrollHeight : prevTop;
    if (scrollBottom) setTimeout(() => (vm.scrollTop = vm.scrollHeight), 150);
  }

  async function appendAndRender(m) {
    S.msgs.push(m);
    await reloadAll();
    renderChatHeader();
    renderChat(true);
    updateSyncBadge();
  }

  /* ---------------- 添加存档 ---------------- */
  function openSheet(html, opts = {}) {
    const wrap = $("#sheetWrap");
    // 每次都换一个新的 #sheet 节点：旧节点上挂过的 click 监听随它一起丢掉，
    // 否则长按菜单开过的次数越多，点一次按钮就会重复触发几次
    const fresh = document.getElementById("sheet").cloneNode(false);
    document.getElementById("sheet").replaceWith(fresh);
    fresh.innerHTML = `<div class="grabber"></div><button class="icon-btn sheet-close" id="sheetClose" aria-label="关闭">${ICON.x}</button>${html}`;
    wrap.hidden = false;
    fresh.style.maxHeight = opts.tall === false ? "70%" : "90%";
    fresh.scrollTop = 0;
    $("#sheetClose").onclick = closeSheet;
    return fresh;
  }
  function closeSheet() {
    $("#sheetWrap").hidden = true;
    $("#sheet").innerHTML = "";
    const t = $("#toast");
    t.classList.remove("show", "top");
  }

  async function openArtistSheet(artist) {
    const isNew = !artist;
    const a = artist || { name: "", group: "", avatarThumb: null };
    const sheet = openSheet(`
      <h2>${isNew ? "新建艺人" : "编辑艺人"}</h2>
      <div class="field"><label>名字</label><input id="fName" placeholder="例如：Yejin" value="${esc(a.name)}"></div>
      <div class="field"><label>团体 / 备注（可留空）</label><input id="fGroup" placeholder="例如：LUMI" value="${esc(a.group || "")}"></div>
      <div class="field"><label>头像（可选）</label>
        <button class="filepick" id="pickAvatar" style="padding:14px">
          ${ICON.image}<span>从相册选择头像</span><small>不上传，只存本地小图</small>
        </button>
        <div class="preview-list" id="avPrev"></div>
        <input type="file" id="avFile" accept="image/*" hidden>
      </div>
      <button class="btn save" id="saveArtist">${isNew ? "创建" : "保存"}</button>
      ${isNew ? "" : `<button class="btn danger" id="delArtist" style="margin-top:10px">删除这位艺人和全部存档</button>`}
    `);
    let avBlob = a.avatarThumb || null;
    const showPrev = () => {
      $("#avPrev").innerHTML = avBlob ? `<div class="pv"><img src="${blobUrl("tmpav", avBlob)}"></div>` : "";
    };
    showPrev();
    $("#pickAvatar").onclick = () => $("#avFile").click();
    $("#avFile").onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      avBlob = await makeThumbBlob(f, 320, 0.85);
      urls.delete("tmpav");
      showPrev();
    };
    $("#saveArtist").onclick = async () => {
      const name = $("#fName").value.trim();
      if (!name) return toast("名字不能为空");
      const rec = {
        id: a.id || uid(),
        name,
        group: $("#fGroup").value.trim(),
        avatarThumb: avBlob,
        color: a.color || colorOf(name),
        createdAt: a.createdAt || new Date().toISOString(),
        driveFolderId: a.driveFolderId || "",
      };
      await DB.put("artists", rec);
      closeSheet();
      await reloadAll();
      renderHome();
      toast(isNew ? "已创建" : "已保存");
      if (S.view === "chat" && S.artist && S.artist.id === rec.id) {
        S.artist = rec;
        renderChatHeader();
      }
      return rec;
    };
    if (!isNew) {
      $("#delArtist").onclick = async () => {
        if (!confirm(`确定删除「${a.name}」及其全部存档？\n（云端 Google Drive 里的文件不会被删除）`)) return;
        const ids = (await DB.byIndex("messages", "artistId", a.id)).map((m) => m.id);
        await DB.delMany("messages", ids);
        await DB.del("artists", a.id);
        closeSheet();
        goHome();
        await reloadAll();
        renderHome();
        toast("已删除");
      };
    }
  }

  function autoGrow(el, max) {
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      const h = Math.min(el.scrollHeight + 2, max || window.innerHeight * 0.32);
      el.style.height = Math.max(h, 96) + "px";
    };
    el.addEventListener("input", fit);
    el.addEventListener("focus", fit);
    setTimeout(fit, 0);
    fit();
  }

  function countLines(el, out) {
    if (!el || !out) return;
    const upd = () => {
      const v = el.value;
      out.textContent = v ? `${v.split("\n").length} 行 · ${v.length} 字` : "0 字";
    };
    el.addEventListener("input", upd);
    upd();
  }

  async function openAddSheet(defaultArtistId) {
    const artists = S.artists;
    if (!artists.length) {
      toast("先建一位艺人吧");
      return openArtistSheet(null);
    }
    const aid = defaultArtistId || (S.artist && S.artist.id) || artists[0].id;
    const now = new Date();
    const dstr =
      S.settings.lastDate ||
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const sheet = openSheet(`
      <h2>添加一条存档</h2>
      <div class="field" style="margin-top:0">
        <label>归属艺人</label>
        <select id="fArtist" style="width:100%;border:1px solid var(--line);border-radius:11px;padding:10px 11px;font-size:13px;background:#fafbff;font-family:inherit;color:var(--ink)">
          ${artists.map((a) => `<option value="${esc(a.id)}" ${a.id === aid ? "selected" : ""}>${esc(a.name)}${a.group ? " · " + esc(a.group) : ""}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>这条是谁发的</label>
        <div class="seg" id="segRole"><button data-v="artist" class="on">艺人</button><button data-v="me">我</button></div>
      </div>
      <div class="tabs" id="tabsType">
        <button class="tab on" data-v="text">文字</button>
        <button class="tab" data-v="image">图片</button>
        <button class="tab" data-v="video">视频</button>
        <button class="tab" data-v="voice">语音</button>
      </div>
      <div class="field"><label>发送时间</label><input type="datetime-local" id="fTime" value="${dstr}"></div>
      <div class="pane" id="paneText">
        <div class="field" style="margin-top:0"><label>原文（韩语 / 原 App 里的那句话）</label>
          <textarea class="msg-input" id="fText" placeholder="粘贴从原 App 复制过来的文字…"></textarea>
          <div class="ta-meta" id="cText">0 字</div>
        </div>
        <div class="field"><label>中文对照（可选，两行一起看）</label>
          <textarea class="msg-input" id="fTextZh" placeholder="中文意思，留空就只存原文"></textarea>
        </div>
        <div id="quoteBox" hidden>
          <div class="field" style="margin-top:0"><label>这条是不是引用某条消息的回复？</label>
            <div class="seg" id="segQuote">
              <button data-v="none" class="on">不是</button>
              <button data-v="fan">引用粉丝</button>
              <button data-v="me">回复我</button>
            </div>
          </div>
          <div id="quotePane" hidden>
            <div class="field" id="myNameField" hidden><label>我的昵称（显示成「回复给 …」）</label>
              <input id="fMyName" placeholder="例如 umji" value="${esc(S.settings.myName || "")}">
            </div>
            <div class="field"><label>被引用的那句话（原文）</label>
              <textarea class="msg-input" id="fQText" style="min-height:60px" placeholder="例如：아직도 외계인인가👽"></textarea>
            </div>
            <div class="field"><label>被引用中文对照（可选）</label>
              <textarea class="msg-input" id="fQZh" style="min-height:60px" placeholder="中文意思"></textarea>
            </div>
          </div>
        </div>
      </div>
      <div class="pane" id="paneFile" hidden>
        <button class="filepick" id="pickFile">
          <span id="pickIcon">${ICON.image}</span>
          <span id="pickLabel">选择图片</span>
          <small id="pickHint">可多选，每张存成一条</small>
        </button>
        <input type="file" id="fFile" hidden>
        <div class="preview-list" id="filePrev"></div>
      </div>
      <div class="sheet-foot">
        <button class="btn save" id="saveMsg">保存到存档</button>
        <p class="hint" id="addStatus" style="text-align:center;margin-top:8px"></p>
        <p class="hint" style="text-align:center">图片会自动压缩缩略图留在手机${S.settings.clientId ? "，原图上传到 Google Drive" : "，原图先存在本地"}</p>
      </div>
    `);

    let saved = 0;
    ["#fText", "#fTextZh"].forEach((id) => autoGrow($(id), window.innerHeight * 0.22));
    countLines($("#fText"), $("#cText"));

    let role = "artist";
    let type = "text";
    let files = [];

    let quoteType = "none";
    const setQuote = (v) => {
      quoteType = v;
      $$("#segQuote button").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
      $("#quotePane").hidden = v === "none";
      $("#myNameField").hidden = v !== "me";
    };
    const setRole = (v) => {
      role = v;
      $$("#segRole button").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
      $("#quoteBox").hidden = v !== "artist";
      if (v !== "artist") setQuote("none");
    };
    $("#segQuote").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b) setQuote(b.dataset.v);
    });
    setQuote("none");
    setRole(role);
    const setType = (v) => {
      type = v;
      $$("#tabsType .tab").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
      $("#paneText").hidden = v !== "text";
      $("#paneFile").hidden = v === "text";
      const map = {
        image: [ICON.image, "选择图片", "可多选，每张存成一条", "image/*"],
        video: [ICON.film, "选择视频", "视频原文件会上传云端", "video/*"],
        voice: [ICON.mic, "选择音频", "语音文件会上传云端", "audio/*"],
      };
      if (map[v]) {
        $("#pickIcon").innerHTML = map[v][0];
        $("#pickLabel").textContent = map[v][1];
        $("#pickHint").textContent = map[v][2];
        $("#fFile").accept = map[v][3];
      }
    };
    $("#segRole").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b) setRole(b.dataset.v);
    });
    $("#tabsType").addEventListener("click", (e) => {
      const b = e.target.closest(".tab");
      if (b) setType(b.dataset.v);
    });
    $("#pickFile").onclick = () => $("#fFile").click();
    $("#fFile").onchange = async (e) => {
      files = Array.from(e.target.files || []);
      $("#filePrev").innerHTML = "";
      for (const f of files.slice(0, 9)) {
        if (type === "image") {
          const t = await makeThumbBlob(f, 160, 0.7);
          $("#filePrev").insertAdjacentHTML("beforeend", `<div class="pv"><img src="${blobUrl("p" + f.name + f.size, t)}"></div>`);
        } else {
          $("#filePrev").insertAdjacentHTML(
            "beforeend",
            `<div class="pv" style="display:grid;place-items:center"><span style="font-size:11px;color:#6b7086">${type === "video" ? "视频" : "音频"} ${
              files.length
            }</span></div>`
          );
        }
      }
    };

    $("#saveMsg").onclick = async () => {
      const artistId = $("#fArtist").value;
      const timeVal = $("#fTime").value;
      const sent = timeVal ? new Date(timeVal) : new Date();
      const sentAt = sent.toISOString();
      S.settings.lastDate = `${sent.getFullYear()}-${pad(sent.getMonth() + 1)}-${pad(sent.getDate())}T${pad(sent.getHours())}:${pad(
        sent.getMinutes()
      )}`;
      await saveSettings();

      if (type === "text") {
        const text = $("#fText").value.trim();
        if (!text) return toast("还没有内容");
        const myName = ($("#fMyName") ? $("#fMyName").value.trim() : "") || "";
        const qText = ($("#fQText") ? $("#fQText").value.trim() : "");
        const quote =
          role === "artist" && quoteType !== "none" && qText
            ? {
                type: quoteType,
                name: quoteType === "me" ? myName || "我" : "",
                text: qText,
                textZh: $("#fQZh") ? $("#fQZh").value.trim() : "",
              }
            : null;
        if (quote && quoteType === "me" && myName) {
          S.settings.myName = myName;
          await saveSettings();
        }
        const m = {
          id: uid(),
          artistId,
          role,
          type: "text",
          text,
          textZh: $("#fTextZh").value.trim(),
          quote,
          sentAt,
          createdAt: new Date().toISOString(),
          starred: false,
          syncState: "text",
        };
        await DB.put("messages", m);
        saved++;
        if (S.view === "chat" && S.artist && S.artist.id === artistId) {
          await appendAndRender(m);
        } else {
          await reloadAll();
          renderHome();
        }
        // 保持面板打开，方便连续粘贴下一条
        $("#fText").value = "";
        $("#fTextZh").value = "";
        if ($("#fQText")) $("#fQText").value = "";
        if ($("#fQZh")) $("#fQZh").value = "";
        setQuote("none");
        $("#fText").focus();
        $("#cText").textContent = "0 字";
        ["#fText", "#fTextZh"].forEach((id) => { $(id).style.height = ""; });
        $("#addStatus").textContent = `已存入 ${saved} 条，可以继续粘贴下一条`;
        toast("已存入存档");
        return;
      }

      if (!files.length) return toast("先选一个文件");
      closeSheet();
      toast("正在处理…", 1200);
      let i = 0;
      let last = null;
      for (const f of files) {
        const t = new Date(sent.getTime() + i * 1000).toISOString();
        const prep = await prepareMedia(f, type);
        const m = {
          id: uid(),
          artistId,
          role,
          type,
          text: "",
          textZh: "",
          sentAt: t,
          createdAt: new Date().toISOString(),
          starred: false,
          syncState: S.settings.clientId ? "pending" : "local",
          media: prep,
        };
        await DB.put("messages", m);
        last = m;
        i++;
        if (S.settings.clientId && Drive.ready()) queueUpload(m);
      }
      if (S.view === "chat" && S.artist && S.artist.id === artistId) {
        await loadChatMsgs();
        renderChatHeader();
        renderChat(true);
        await reloadAll();
      } else {
        await reloadAll();
        renderHome();
      }
      updateSyncBadge();
      toast(S.pending > 0 ? `已存档，${S.pending} 个原文件待上传云端` : "已存档");
    };
  }

  /* ---------------- 媒体处理 ---------------- */
  function canvasToBlob(canvas, quality) {
    return new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", quality || 0.82));
  }

  async function makeThumbBlob(file, maxSide, quality) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale));
      const h = Math.max(1, Math.round(bmp.height * scale));
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext("2d");
      ctx.drawImage(bmp, 0, 0, w, h);
      bmp.close && bmp.close();
      return await canvasToBlob(cv, quality);
    } catch (e) {
      return null;
    }
  }

  function placeholderThumb(kind, dur) {
    const cv = document.createElement("canvas");
    cv.width = 400;
    cv.height = 460;
    const ctx = cv.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 400, 460);
    g.addColorStop(0, kind === "video" ? "#3a3550" : "#8478b8");
    g.addColorStop(1, kind === "video" ? "#1c1a28" : "#5b4d9a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 400, 460);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "600 44px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(kind === "video" ? "▶" : "♪", 200, 246);
    ctx.font = "500 20px -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(kind === "video" ? "视频" : fmtDur(dur), 200, 286);
    return new Promise((res) => cv.toBlob((b) => res(b), "image/jpeg", 0.8));
  }

  async function prepareMedia(file, type) {
    const base = {
      full: file,
      name: file.name || "file",
      mime: file.type || "application/octet-stream",
      size: file.size,
      w: 0,
      h: 0,
      duration: 0,
    };
    if (type === "image") {
      try {
        const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
        base.w = bmp.width;
        base.h = bmp.height;
        bmp.close && bmp.close();
      } catch (e) {}
      base.thumb = (await makeThumbBlob(file, S.settings.thumbMax, S.settings.quality)) || (await placeholderThumb("image"));
      return base;
    }
    if (type === "video") {
      try {
        const info = await videoThumb(file);
        base.thumb = info.thumb;
        base.w = info.w;
        base.h = info.h;
        base.duration = info.duration;
      } catch (e) {
        base.thumb = await placeholderThumb("video");
      }
      return base;
    }
    // voice
    try {
      base.duration = await audioDuration(file);
    } catch (e) {}
    base.thumb = await placeholderThumb("voice", base.duration);
    base.waves = Array.from({ length: 14 }, (_, i) => 2 + Math.round(Math.abs(Math.sin(i * 1.7)) * 8 + Math.random() * 2));
    return base;
  }

  function videoThumb(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.playsInline = true;
      v.src = url;
      const cleanup = () => {
        URL.revokeObjectURL(url);
        v.remove();
      };
      v.onerror = () => {
        cleanup();
        reject(new Error("无法读取视频"));
      };
      v.onloadeddata = () => {
        try {
          v.currentTime = Math.min(0.2, (v.duration || 1) / 3);
        } catch (e) {}
      };
      v.onseeked = async () => {
        try {
          const w = v.videoWidth || 720;
          const h = v.videoHeight || 1280;
          const scale = Math.min(1, 420 / Math.max(w, h));
          const cv = document.createElement("canvas");
          cv.width = Math.round(w * scale);
          cv.height = Math.round(h * scale);
          cv.getContext("2d").drawImage(v, 0, 0, cv.width, cv.height);
          const blob = await canvasToBlob(cv, 0.82);
          const dur = v.duration || 0;
          cleanup();
          resolve({ thumb: blob, w, h, duration: dur });
        } catch (e) {
          cleanup();
          reject(e);
        }
      };
      setTimeout(() => {
        if (!v.onseeked) return;
        reject(new Error("视频截帧超时"));
        cleanup();
      }, 6000);
    });
  }

  function audioDuration(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const a = new Audio();
      a.preload = "metadata";
      a.src = url;
      a.onloadedmetadata = () => {
        const d = a.duration;
        URL.revokeObjectURL(url);
        resolve(isFinite(d) ? d : 0);
      };
      a.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("无法读取音频"));
      };
    });
  }

  /* ---------------- 云端同步 ---------------- */
  let uploadChain = Promise.resolve();

  function queueUpload(msg) {
    uploadChain = uploadChain
      .then(() => uploadOne(msg))
      .catch((e) => {
        console.warn("[upload]", e);
      });
  }

  async function ensureRootFolder() {
    if (S.settings.rootFolderId) return S.settings.rootFolderId;
    const id = await Drive.ensureFolder("泡泡存档", null);
    S.settings.rootFolderId = id;
    await saveSettings();
    return id;
  }

  async function ensureArtistFolder(artist) {
    const root = await ensureRootFolder();
    if (artist.driveFolderId) return artist.driveFolderId;
    const id = await Drive.ensureFolder(artist.name || artist.id, root);
    artist.driveFolderId = id;
    await DB.put("artists", artist);
    await reloadAll();
    return id;
  }

  async function ensureMonthFolder(artistFolderId, month) {
    const key = artistFolderId + "|" + month;
    S.settings.monthFolders = S.settings.monthFolders || {};
    if (S.settings.monthFolders[key]) return S.settings.monthFolders[key];
    const id = await Drive.ensureFolder(month, artistFolderId);
    S.settings.monthFolders[key] = id;
    await saveSettings();
    return id;
  }

  function extOf(mime, name) {
    const map = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "video/mp4": ".mp4", "video/quicktime": ".mov", "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/aac": ".aac", "audio/wav": ".wav" };
    if (map[mime]) return map[mime];
    const m = /(\.[a-z0-9]{2,5})$/i.exec(name || "");
    return m ? m[1] : "";
  }

  async function uploadOne(msg) {
    if (!msg.media || !msg.media.full) return;
    if (driveIdOf(msg)) return;
    if (!Drive.getClientId()) throw new Error("还没有填写 OAuth 客户端 ID");
    if (!Drive.ready()) throw new Error("云端未授权，先点「连接 Google Drive」");

    const artist = S.artists.find((a) => a.id === msg.artistId) || { id: msg.artistId, name: msg.artistId };
    const artistFolder = await ensureArtistFolder(artist);
    const month = msg.sentAt.slice(0, 7);
    const monthFolder = await ensureMonthFolder(artistFolder, month);
    const name =
      msg.sentAt.replace(/[-:]/g, "").replace("T", "_").slice(0, 15) +
      "_" +
      msg.id.slice(0, 4) +
      extOf(msg.media.mime, msg.media.name);

    const fileId = await Drive.upload(msg.media.full, { name, mime: msg.media.mime, parentId: monthFolder });
    msg.driveId = fileId;
    msg.syncState = "cloud";
    msg.media.full = null;
    await DB.put("messages", msg);
    await reloadAll();
    updateSyncBadge();
    if (S.view === "chat" && S.artist && S.artist.id === msg.artistId) {
      await loadChatMsgs();
      renderChat(false);
    }
    if (S.view === "settings") renderSettings();
  }

  /* 手动备份：把整库 JSON 传到 Drive 的「泡泡存档/备份」 */
  async function backupToDrive() {
    if (!Drive.getClientId()) {
      toast("先在上面填 OAuth 客户端 ID 并连接");
      return;
    }
    const btn = $("#btnBackupCloud");
    const label = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "正在备份…";
    }
    try {
      toast("正在连接云端…", 1200);
      await Drive.connect();
      const artists = await DB.all("artists");
      const messages = await DB.all("messages");
      const payload = {
        app: "bubble-archive",
        version: 1,
        exportedAt: new Date().toISOString(),
        artists,
        messages: messages.map(stripMedia),
      };
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const root = S.settings.rootFolderId || (await Drive.ensureFolder("泡泡存档", null));
      S.settings.rootFolderId = root;
      const dir = await Drive.ensureFolder("备份", root);
      S.settings.backupFolderId = dir;
      const d = new Date();
      const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
      await Drive.upload(blob, { name: `存档备份-${stamp}.json`, mime: "application/json", parentId: dir });
      S.settings.lastBackup = new Date().toISOString();
      S.settings.lastBackupCount = messages.length;
      await saveSettings();
      toast(`已备份 ${artists.length} 位艺人、${messages.length} 条（${fmtSize(blob.size)}）`, 2800);
      renderSettings();
    } catch (e) {
      toast("备份失败：" + (e.message || e), 3200);
      if (btn) {
        btn.disabled = false;
        btn.textContent = label;
      }
    }
  }

  async function syncAll(interactive) {
    if (!Drive.getClientId()) {
      toast("先在设置里填 OAuth 客户端 ID");
      return;
    }
    const ok = await Drive.connect().catch((e) => {
      toast(e.message || "连接失败");
      return null;
    });
    if (!ok) return;
    const msgs = await DB.all("messages");
    const todo = msgs.filter((m) => m.media && m.media.full && !driveIdOf(m));
    if (!todo.length) return toast("都已经同步过了");
    toast(`开始上传 ${todo.length} 个文件…`, 3000);
    let done = 0;
    for (const m of todo) {
      try {
        await uploadOne(m);
        done++;
        toast(`已上传 ${done}/${todo.length}`, 1500);
      } catch (e) {
        toast("上传中断：" + (e.message || e));
        break;
      }
    }
    await reloadAll();
    updateSyncBadge();
    if (S.view === "settings") renderSettings();
  }

  function updateSyncBadge() {
    const banner = $("#syncBanner");
    if (!banner) return;
    if (S.pending > 0) {
      banner.hidden = false;
      banner.innerHTML = `<span>${ICON.cloud} ${S.pending} 个原文件待上传</span><button id="btnBannerSync">立刻同步</button>`;
      $("#btnBannerSync").onclick = () => syncAll(true);
    } else {
      banner.hidden = true;
    }
  }

  /* ---------------- 编辑一条存档 ---------------- */
  function openEditSheet(msg) {
    closeSheet();
    const d = new Date(msg.sentAt);
    const val = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setTimeout(() => {
      openSheet(`
        <h2>编辑这条存档</h2>
        <div class="field" style="margin-top:0"><label>${msg.type === "text" ? "原文" : "配文"}（韩语 / 原文）</label>
          <textarea class="msg-input" id="eText" placeholder="原文">${esc(msg.text || "")}</textarea>
        </div>
        <div class="field"><label>中文对照</label>
          <textarea class="msg-input" id="eZh" placeholder="中文意思，可留空">${esc(msg.textZh || "")}</textarea>
        </div>
        ${
          msg.quote
            ? `<div class="field"><label>引用区标题</label>
                 <div class="seg" id="eQType">
                   <button data-v="fan" ${msg.quote.type !== "me" ? "class=\"on\"" : ""}>ARTIST的回复</button>
                   <button data-v="me" ${msg.quote.type === "me" ? "class=\"on\"" : ""}>回复给…</button>
                 </div></div>
               <div class="field"><label>「回复给」的名字</label>
                 <input id="eQName" value="${esc(msg.quote.name || S.settings.myName || "我")}">
               </div>
               <div class="field"><label>被引用的原文</label>
                 <textarea class="msg-input" id="eQText" style="min-height:60px">${esc(msg.quote.text || "")}</textarea>
               </div>
               <div class="field"><label>被引用中文对照</label>
                 <textarea class="msg-input" id="eQZh" style="min-height:60px">${esc(msg.quote.textZh || "")}</textarea>
               </div>`
            : ""
        }
        <div class="field"><label>发送时间</label><input type="datetime-local" id="eTime" value="${val}"></div>
        <div class="sheet-foot">
          <button class="btn save" id="eSave">保存修改</button>
          <button class="btn ghost" id="eCancel" style="margin-top:8px">取消</button>
        </div>
      `);
      autoGrow($("#eText"), window.innerHeight * 0.22);
      autoGrow($("#eZh"), window.innerHeight * 0.22);
      $("#eCancel").onclick = closeSheet;
      let eQType = msg.quote ? (msg.quote.type === "me" ? "me" : "fan") : "";
      const eQSeg = $("#eQType");
      if (eQSeg)
        eQSeg.addEventListener("click", (e) => {
          const b = e.target.closest("button");
          if (!b) return;
          eQType = b.dataset.v;
          [...eQSeg.children].forEach((x) => x.classList.toggle("on", x.dataset.v === eQType));
        });
      $("#eSave").onclick = async () => {
        msg.text = $("#eText").value.trim();
        msg.textZh = $("#eZh").value.trim();
        if (msg.quote) {
          msg.quote.type = eQType || "fan";
          msg.quote.name = ($("#eQName") ? $("#eQName").value.trim() : "") || "我";
          msg.quote.text = ($("#eQText") ? $("#eQText").value.trim() : "");
          msg.quote.textZh = ($("#eQZh") ? $("#eQZh").value.trim() : "");
          if (!msg.quote.text) msg.quote = null;
        }
        const t = $("#eTime").value;
        if (t) msg.sentAt = new Date(t).toISOString();
        await DB.put("messages", msg);
        closeSheet();
        await loadChatMsgs();
        renderChat(false);
        await reloadAll();
        renderChatHeader();
        toast("已保存修改");
      };
    }, 240);
  }

  /* ---------------- 长按菜单 ---------------- */
  function openMsgMenu(msg) {
    const sheet = openSheet(`
      <h2 style="margin-bottom:6px">这条存档</h2>
      <div class="menu">
        <button data-act="star">${msg.starred ? ICON.starFill : ICON.star}<span>${msg.starred ? "取消收藏" : "收藏"}</span></button>
        ${msg.type !== "text" ? `<button data-act="view">${ICON.image}<span>${msg.type === "image" ? "查看原图" : msg.type === "video" ? "播放视频" : "播放语音"}</span></button>` : ""}
        <button data-act="edit">${ICON.pencil}<span>编辑${msg.type === "text" ? "文字" : "配文"} / 译文</span></button>
        ${msg.type === "text" || msg.text ? `<button data-act="copy">${ICON.copy}<span>复制原文</span></button>` : ""}
        ${msg.textZh ? `<button data-act="copyzh">${ICON.copy}<span>复制中文对照</span></button>` : ""}
        <button data-act="time">${ICON.clock}<span>修改时间</span></button>
        ${msg.type !== "text" && driveIdOf(msg) ? `<button data-act="download">${ICON.download}<span>从云端下载原文件</span></button>` : ""}
        <button data-act="delete" class="danger">${ICON.trash}<span>删除这一条</span></button>
      </div>
    `);
    sheet.addEventListener("click", async (e) => {
      const b = e.target.closest(".menu button");
      if (!b) return;
      const act = b.dataset.act;
      if (act === "star") {
        msg.starred = !msg.starred;
        await DB.put("messages", msg);
        closeSheet();
        S.onlyStar ? renderChat(false) : renderChat(false);
      } else if (act === "view") {
        closeSheet();
        setTimeout(() => openViewer(msg), 220);
      } else if (act === "edit") {
        openEditSheet(msg);
      } else if (act === "copyzh") {
        try {
          await navigator.clipboard.writeText(msg.textZh || "");
          toast("已复制中文");
        } catch (err) {
          toast("复制失败");
        }
        closeSheet();
      } else if (act === "copy") {
        try {
          await navigator.clipboard.writeText(msg.text);
          toast("已复制");
        } catch (err) {
          toast("复制失败，请长按气泡手动复制");
        }
        closeSheet();
      } else if (act === "time") {
        closeSheet();
        const d = new Date(msg.sentAt);
        const val = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setTimeout(() => {
          const sheet2 = openSheet(`
            <h2>修改发送时间</h2>
            <div class="field"><input type="datetime-local" id="tVal" value="${val}"></div>
            <button class="btn save" id="tSave">保存</button>`);
          $("#tSave").onclick = async () => {
            const v = $("#tVal").value;
            if (!v) return;
            msg.sentAt = new Date(v).toISOString();
            await DB.put("messages", msg);
            closeSheet();
            await loadChatMsgs();
            renderChat(false);
            await reloadAll();
            toast("已修改");
          };
        }, 260);
      } else if (act === "download") {
        closeSheet();
        fetchAndDownload(msg);
      } else if (act === "delete") {
        closeSheet();
        setTimeout(() => openDeleteSheet(msg), 240);
      }
    });
  }

  /* 删除确认：可选是否连云端原文件一起删 */
  async function afterDelete() {
    await loadChatMsgs();
    renderChat(false);
    await reloadAll();
    renderChatHeader();
  }

  function openDeleteSheet(msg) {
    const cloudId = driveIdOf(msg);
    const typeLabel = msg.type === "image" ? "图片" : msg.type === "video" ? "视频" : msg.type === "voice" ? "语音" : "文字";
    const media = msg.media || {};
    const sizeTxt = media.size ? fmtSize(media.size) : "";
    const sheet = openSheet(`
      <h2 style="margin-bottom:6px">删除这条存档？</h2>
      <p class="hint">${typeLabel}${sizeTxt ? " · " + sizeTxt : ""}${
      msg.sentAt ? " · " + fmtClock(msg.sentAt) : ""
    }</p>
      <div class="menu" style="margin-top:10px">
        <button data-del="local">${ICON.trash}<span>只删这条存档（云端保留）</span></button>
        ${cloudId ? `<button data-del="cloud" class="danger">${ICON.trash}<span>连 Drive 原文件一起删</span></button>` : ""}
      </div>
      <p class="hint" style="margin-top:8px">${
        cloudId
          ? "只删存档：Drive 里的原文件保留，以后还能重新取回。一起删：原文件会进 Drive 回收站（一般 30 天内可恢复）。"
          : "这条没有云端文件，删掉就没了。"
      }</p>
    `);
    sheet.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-del]");
      if (!b) return;
      const mode = b.dataset.del;
      if (mode === "cloud") {
        const label = b.innerHTML;
        b.disabled = true;
        b.textContent = "正在删除云端…";
        try {
          await Drive.connect();
          await Drive.remove(cloudId);
        } catch (err) {
          toast("云端删除失败：" + (err.message || err), 3200);
          b.disabled = false;
          b.innerHTML = label;
          return;
        }
        await DB.del("messages", msg.id);
        closeSheet();
        await afterDelete();
        toast("已删除（含云端原文件）");
      } else {
        await DB.del("messages", msg.id);
        closeSheet();
        await afterDelete();
        toast(cloudId ? "已删除存档（云端原文件保留）" : "已删除");
      }
    });
  }

  /* ---------------- 大图 / 播放 ---------------- */
  async function openViewer(msg) {
    const v = $("#viewer");
    const body = $("#vbody");
    S.viewerMsg = msg;
    $("#vTitle").textContent = msg.type === "image" ? "原图" : msg.type === "video" ? "视频" : "语音";
    v.hidden = false;
    body.innerHTML = `<div class="vloading"><span class="spinner"></span>正在读取…</div>`;
    let blob = null;
    if (msg.media && asBlob(msg.media.full)) blob = msg.media.full;
    else if (driveIdOf(msg)) {
      if (!Drive.getClientId()) {
        body.innerHTML = `<div class="vloading">这个原文件在 Google Drive 上<br>先在设置里连接云端</div>`;
        return;
      }
      try {
        blob = await Drive.fetchBlob(driveIdOf(msg));
      } catch (e) {
        body.innerHTML = `<div class="vloading">读取失败：${esc(e.message)}<br>检查网络或重新连接云端</div>`;
        return;
      }
    } else if (msg.media && asBlob(msg.media.thumb)) {
      blob = msg.media.thumb;
    }
    if (!blob) {
      body.innerHTML = `<div class="vloading">没有可显示的文件</div>`;
      return;
    }
    const u = URL.createObjectURL(blob);
    if (msg.type === "image") {
      body.innerHTML = `<img src="${u}" alt="">`;
    } else if (msg.type === "video") {
      body.innerHTML = `<video src="${u}" controls autoplay playsinline style="max-height:100%"></video>`;
    } else {
      body.innerHTML = `<audio src="${u}" controls autoplay style="width:min(86vw,420px)"></audio>`;
    }
    // 从云端取回原图后，顺手补一张缩略图存回本地（导入备份后特别有用）
    if ((msg.type === "image" || msg.type === "video") && (!asBlob(msg.media.thumb) || !msg.media.w)) healThumb(msg, blob);
  }

  async function healThumb(msg, blob) {
    try {
      let w = msg.media.w || 0;
      let h = msg.media.h || 0;
      if (!w || !h) {
        const bmp = await createImageBitmap(blob);
        w = bmp.width;
        h = bmp.height;
        bmp.close && bmp.close();
      }
      const thumb = await makeThumbBlob(blob, S.settings.thumbMax, S.settings.quality);
      if (!thumb) return;
      msg.media.thumb = thumb;
      msg.media.w = w;
      msg.media.h = h;
      await DB.put("messages", msg);
      if (S.view === "chat" && S.artist && S.artist.id === msg.artistId) {
        await loadChatMsgs();
        renderChat(false);
      }
    } catch (e) {
      /* 视频截帧失败就算了，不影响查看 */
    }
  }

  async function fetchAndDownload(msg) {
    try {
      const blob = msg.media && msg.media.full ? msg.media.full : driveIdOf(msg) ? await Drive.fetchBlob(driveIdOf(msg)) : null;
      if (!blob) return toast("没有原文件");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = msg.media.name || "archive-file";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast("已保存到下载目录");
    } catch (e) {
      toast("下载失败：" + e.message);
    }
  }

  /* ---------------- 设置页 ---------------- */
  function openSettings() {
    S.view = "settings";
    $("#view-home").hidden = true;
    $("#view-chat").hidden = true;
    $("#view-settings").hidden = false;
    renderSettings();
  }

  async function renderSettings() {
    const el = $("#settingsBody");
    let usage = { usage: 0, quota: 0 };
    try {
      usage = (await navigator.storage.estimate()) || usage;
    } catch (e) {}
    const msgs = await DB.all("messages");
    const mediaCount = msgs.filter((m) => m.type !== "text").length;
    const cloudCount = msgs.filter((m) => driveIdOf(m)).length;
    const pending = msgs.filter((m) => m.syncState === "pending" && m.media && m.media.full).length;
    const localFull = msgs.filter((m) => m.media && m.media.full).reduce((a, m) => a + ((m.media.full && m.media.full.size) || 0), 0);
    const connected = Drive.ready();
    const lastBk = S.settings.lastBackup ? new Date(S.settings.lastBackup) : null;
    const bkText = lastBk
      ? `上次手动备份：${lastBk.getFullYear()}-${pad(lastBk.getMonth() + 1)}-${pad(lastBk.getDate())} ${pad(lastBk.getHours())}:${pad(
          lastBk.getMinutes()
        )}（包含 ${S.settings.lastBackupCount || 0} 条存档）`
      : "还没有备份过。建议存完一批就手动点一次。";

    el.innerHTML = `
      <div class="card">
        <h3>${ICON.cloud}Google Drive 云存档</h3>
        <p class="hint">文字和缩略图在手机里，原图 / 视频传到云端，手机不会被塞满。</p>
        <div style="display:flex;align-items:center;gap:8px;margin:10px 0 2px">
          <span class="status-pill ${connected ? "on" : pending ? "warn" : ""}"><i></i>${connected ? "已连接" : pending ? "有 " + pending + " 个待上传" : "未连接"}</span>
          ${pending ? `<span class="hint">· ${pending} 个文件等待上传</span>` : ""}
        </div>
        <div class="field">
          <label>Google OAuth 客户端 ID</label>
          <input id="fClient" class="mono" placeholder="xxxxxxxx.apps.googleusercontent.com" value="${esc(S.settings.clientId)}">
        </div>
        <div class="btn-row">
          <button class="btn" id="btnConnect">${connected ? "重新授权" : "连接 Google Drive"}</button>
          <button class="btn secondary" id="btnSyncNow">立刻同步</button>
        </div>
        ${S.settings.rootFolderId ? `<div class="btn-row"><button class="btn ghost" id="btnOpenDrive">打开云端文件夹 ${ICON.link}</button><button class="btn ghost" id="btnUnlink">断开</button></div>` : ""}
        <p class="hint" style="margin-top:10px">${
          connected
            ? "原图会传进你 Drive 里的「泡泡存档」文件夹，按艺人和月份分好；换手机后重新连接就能看。"
            : "没填 ID 也能用：图片会先存在手机本地，填好后再一键传上去。申请方法见项目里的「使用说明」。"
        }</p>
      </div>

      <div class="card">
        <h3>${ICON.image}本地占用</h3>
        <div class="stat-row"><span>缩略图 + 未上传原文件</span><b>${fmtSize(usage.usage || 0)}</b></div>
        <div class="stat-row"><span>其中待上传原文件</span><b>${fmtSize(localFull)}</b></div>
        <div class="stat-row"><span>存档条数</span><b>${msgs.length} 条（媒体 ${mediaCount}）</b></div>
        <div class="stat-row"><span>已在云端</span><b>${cloudCount} 个文件</b></div>
        <div class="btn-row"><button class="btn secondary" id="btnClean">清理已上传的本地原图</button></div>
      </div>

      <div class="card">
        <h3>${ICON.copy}数据备份（手动）</h3>
        <p class="hint">只在你点的时候才备份。会把「艺人 + 文字 + 时间 + 中韩对照 + 云端文件 ID」打包成一份 JSON，传到 Drive 的「泡泡存档/备份」里；图片原文件本来就在云端，不会重复传。</p>
        <div class="btn-row">
          <button class="btn" id="btnBackupCloud">现在备份到 Drive</button>
        </div>
        <div class="btn-row">
          <button class="btn secondary" id="btnExport">导出到手机</button>
          <button class="btn secondary" id="btnImport">从 JSON 导入</button>
        </div>
        <p class="hint" id="backupHint">${bkText}</p>
        ${S.settings.backupFolderId ? `<div class="btn-row"><button class="btn ghost" id="btnOpenBackup">打开备份文件夹 ${ICON.link}</button></div>` : ""}
        <input type="file" id="fImport" accept="application/json,.json" hidden>
      </div>

      <div class="card">
        <h3>${ICON.trash}危险操作</h3>
        <div class="btn-row">
          <button class="btn danger" id="btnWipeDemo">清空演示数据</button>
          <button class="btn danger" id="btnWipeAll">清空全部存档</button>
        </div>
      </div>

      <div class="card">
        <h3>关于</h3>
        <p class="hint">泡泡存档 ${APP_VERSION} · 纯单机，不连原 App<br>只读存档：内容只属于你，不会发送给任何人。</p>
        <div class="btn-row"><button class="btn ghost" id="btnForceUpdate">检查更新（清缓存重载）</button></div>
        <p class="hint" id="verHint">正在运行的版本：${APP_VERSION}</p>
      </div>
    `;

    const fClient = $("#fClient");
    fClient.addEventListener("change", async () => {
      S.settings.clientId = fClient.value.trim();
      await saveSettings();
      Drive.setClientId(S.settings.clientId);
      toast(S.settings.clientId ? "已保存，接着点「连接 Google Drive」授权" : "已清空客户端 ID");
    });

    $("#btnConnect").onclick = async () => {
      S.settings.clientId = fClient.value.trim();
      await saveSettings();
      Drive.setClientId(S.settings.clientId);
      if (!S.settings.clientId) return toast("先填 OAuth 客户端 ID");
      try {
        await Drive.connect();
        toast("已连接 Google Drive");
        renderSettings();
      } catch (e) {
        toast("连接失败：" + (e.message || e), 3500);
      }
    };

    $("#btnSyncNow").onclick = () => syncAll(true);

    $("#btnBackupCloud").onclick = backupToDrive;

    $("#btnForceUpdate").onclick = async () => {
      toast("正在清理旧缓存…", 1500);
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch (e) {}
      toast("已清理，正在重新加载（存档数据不受影响）", 2200);
      setTimeout(() => {
        location.reload();
      }, 900);
    };
    const openBackup = $("#btnOpenBackup");
    if (openBackup)
      openBackup.onclick = () => {
        window.open(Drive.folderLink(S.settings.backupFolderId), "_blank");
      };

    const openDrive = $("#btnOpenDrive");
    if (openDrive)
      openDrive.onclick = () => {
        const url = Drive.folderLink(S.settings.rootFolderId);
        window.open(url, "_blank");
      };

    const unlink = $("#btnUnlink");
    if (unlink)
      unlink.onclick = async () => {
        Drive.signOut();
        toast("已断开（云端文件仍保留在 Drive 里）");
        renderSettings();
      };

    $("#btnClean").onclick = async () => {
      const all = await DB.all("messages");
      const targets = all.filter((m) => driveIdOf(m) && m.media && m.media.full);
      if (!targets.length) return toast("没有可清理的本地原文件");
      const freed = targets.reduce((s, m) => s + ((m.media.full && m.media.full.size) || 0), 0);
      if (!confirm(`将删除 ${targets.length} 个已在云端的本地原文件，释放约 ${fmtSize(freed)}。\n（云端文件不受影响，随时可重新下载）`)) return;
      for (const m of targets) {
        m.media.full = null;
        await DB.put("messages", m);
      }
      toast("已清理 " + fmtSize(freed));
      renderSettings();
      await reloadAll();
    };

    $("#btnExport").onclick = async () => {
      const artists = await DB.all("artists");
      const messages = await DB.all("messages");
      const payload = {
        app: "bubble-archive",
        version: 1,
        exportedAt: new Date().toISOString(),
        artists: artists.map((a) => ({ ...a, avatarThumb: null })),
        messages: messages.map(stripMedia),
      };
      downloadJSON(payload, `泡泡存档-${new Date().toISOString().slice(0, 10)}.json`);
      toast("已导出");
    };

    $("#btnImport").onclick = () => $("#fImport").click();
    $("#fImport").onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data.messages) throw new Error("格式不对");
        const artists = await DB.all("artists");
        const ids = new Set(artists.map((a) => a.id));
        // 兼容两种备份：整库导出（artists 数组）和单个对话导出（artist 单数）
        const incoming = data.artists || (data.artist ? [data.artist] : []);
        const newArtists = incoming.filter((a) => a && a.id && !ids.has(a.id));
        const messages = await DB.all("messages");
        const mids = new Set(messages.map((m) => m.id));
        const newMsgs = (data.messages || [])
          .filter((m) => !mids.has(m.id))
          .map((m) => {
            if (!m.media) return m;
            const media = { ...m.media };
            if (!(media.thumb instanceof Blob)) media.thumb = null;
            if (!(media.full instanceof Blob)) media.full = null;
            return { ...m, media };
          });
        await DB.putMany("artists", newArtists);
        await DB.putMany("messages", newMsgs);
        await reloadAll();
        renderHome();
        toast(`导入 ${newArtists.length} 位艺人、${newMsgs.length} 条存档`);
        renderSettings();
      } catch (err) {
        toast("导入失败：" + err.message);
      }
    };

    $("#btnWipeDemo").onclick = async () => {
      if (!confirm("清空所有演示内容？你自己的存档不受影响。")) return;
      const msgs = (await DB.all("messages")).filter((m) => m.demo);
      const arts = (await DB.all("artists")).filter((a) => a.demo);
      await DB.delMany("messages", msgs.map((m) => m.id));
      await DB.delMany("artists", arts.map((a) => a.id));
      await reloadAll();
      renderHome();
      toast("演示数据已清空");
      renderSettings();
    };

    $("#btnWipeAll").onclick = async () => {
      if (!confirm("⚠️ 会删除手机上的全部存档（云端 Google Drive 里的文件不会删）。确定？")) return;
      if (!confirm("再确认一次：这是不可撤销的操作。")) return;
      await DB.clear("messages");
      await DB.clear("artists");
      S.settings.rootFolderId = "";
      S.settings.monthFolders = {};
      await saveSettings();
      await reloadAll();
      goHome();
      renderSettings();
      toast("已清空");
    };
  }

  function downloadJSON(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ---------------- 对话页右上菜单 ---------------- */
  /* ---------------- 按日期查找 ---------------- */
  const WEEK_CN = ["一", "二", "三", "四", "五", "六", "日"];

  function openCalendar() {
    const list = S.msgs;
    if (!list.length) return toast("还没有存档");
    const counts = {};
    list.forEach((m) => {
      const k = dayKey(m.sentAt);
      counts[k] = (counts[k] || 0) + 1;
    });
    // 初始月份：当前列表可见的第一条所在月
    let anchor = list[list.length - 1];
    const rows = [...document.querySelectorAll("#msgList [data-msg]")];
    const vm = $("#msgList");
    const firstVis = rows.find((r) => r.offsetTop + r.offsetHeight > vm.scrollTop + 30);
    if (firstVis) {
      const m = list.find((x) => x.id === firstVis.dataset.msg);
      if (m) anchor = m;
    }
    const ad = d2(anchor.sentAt);
    let cur = new Date(ad.getFullYear(), ad.getMonth(), 1);
    const todayKey = dayKey(new Date().toISOString());

    const sheet = openSheet(`
      <h2 style="margin-bottom:2px">按日期查找</h2>
      <p class="hint" style="margin-bottom:6px">有圆点的日期有存档，点一下直接跳过去。</p>
      <div class="cal-head">
        <button class="cal-nav" id="calPrev" aria-label="上个月"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m14.5 5-6.5 7 6.5 7"/></svg></button>
        <div class="cal-title" id="calTitle"></div>
        <button class="cal-nav" id="calNext" aria-label="下个月"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m9.5 5 6.5 7-6.5 7"/></svg></button>
      </div>
      <div class="cal-grid" id="calGrid"></div>
      <div class="cal-foot">
        <span class="hint" id="calInfo"></span>
        <div class="btn-row" style="margin-top:8px">
          <button class="btn ghost" id="calEarliest">最早</button>
          <button class="btn ghost" id="calLatest">最近</button>
        </div>
        <p class="hint" id="calRange" style="margin-top:6px;text-align:center"></p>
      </div>
    `);

    const renderCal = () => {
      const y = cur.getFullYear();
      const mo = cur.getMonth();
      $("#calTitle").textContent = `${y}年${mo + 1}月`;
      const first = new Date(y, mo, 1);
      const offset = (first.getDay() + 6) % 7; // 周一开头
      const last = new Date(y, mo + 1, 0).getDate();
      let html = WEEK_CN.map((w) => `<div class="cal-w">${w}</div>`).join("");
      for (let i = 0; i < offset; i++) html += `<button class="cal-d blank" disabled></button>`;
      for (let d = 1; d <= last; d++) {
        const k = `${y}-${pad(mo + 1)}-${pad(d)}`;
        const n = counts[k];
        const cls = ["cal-d", n ? "has" : "", k === todayKey ? "today" : ""].join(" ");
        html += `<button class="${cls}" data-d="${k}">${d}${
          k === todayKey ? `<small>TODAY</small>` : ""
        }</button>`;
      }
      $("#calGrid").innerHTML = html;
      const monthCount = Object.keys(counts).filter((k) => k.startsWith(`${y}-${pad(mo + 1)}`)).length;
      $("#calInfo").textContent = monthCount ? `这个月 ${monthCount} 天有存档` : "这个月没有存档";
    };
    renderCal();

    const dayKeys = Object.keys(counts).sort();
    const earliest = dayKeys[0];
    const latest = dayKeys[dayKeys.length - 1];
    const dOf = (k) => {
      const [y, m] = k.split("-").map(Number);
      return new Date(y, m - 1, 1);
    };
    $("#calRange").textContent = `最早的一条：${earliest.replace(/-/g, ".")}`;

    const shift = (n) => {
      const d = new Date(cur.getFullYear(), cur.getMonth() + n, 1);
      const far = n < 0 ? d < new Date(2020, 0, 1) : false;
      cur = d;
      renderCal();
    };
    $("#calPrev").onclick = () => shift(-1);
    $("#calNext").onclick = () => shift(1);
    $("#calEarliest").onclick = () => {
      cur = dOf(earliest);
      renderCal();
    };
    $("#calLatest").onclick = () => {
      cur = dOf(latest);
      renderCal();
    };

    $("#calGrid").addEventListener("click", (e) => {
      const b = e.target.closest("[data-d]");
      if (!b || b.disabled) return;
      const k = b.dataset.d;
      const n = counts[k] || 0;
      if (!n) return toast("这天没有存档");
      const target = list.find((m) => dayKey(m.sentAt) === k);
      closeSheet();
      setTimeout(() => {
        const el = document.querySelector(`#msgList [data-msg="${target.id}"]`);
        if (!el) return toast("找不到这条，试试刷新");
        const vm2 = $("#msgList");
        const row = el.closest(".row") || el;
        const prev = row.previousElementSibling;
        const anchorEl = prev && prev.classList.contains("day-pill") ? prev : row;
        const listTop = vm2.getBoundingClientRect().top;
        const anchorTop = anchorEl.getBoundingClientRect().top;
        vm2.scrollTop = Math.max(0, vm2.scrollTop + (anchorTop - listTop) - 10);
        row.classList.add("flash");
        setTimeout(() => row.classList.remove("flash"), 1800);
      }, 240);
    });
  }

  function openChatMenu() {
    const a = S.artist;
    const sheet = openSheet(`
      <h2>${esc(a.name)}</h2>
      <div class="menu">
        <button data-act="zh-toggle">${ICON.lang}<span>${S.settings.showZh === false ? "显示中文对照" : "只看原文（隐藏中文）"}</span></button>
        <button data-act="star-filter">${ICON.star}<span>${S.onlyStar ? "显示全部消息" : "只看收藏"}</span></button>
        <button data-act="edit">${ICON.pencil}<span>改名 / 换头像</span></button>
        <button data-act="export">${ICON.download}<span>导出这段存档</span></button>
        <button data-act="delete" class="danger">${ICON.trash}<span>删除整段存档</span></button>
      </div>`);
    sheet.addEventListener("click", async (e) => {
      const b = e.target.closest(".menu button");
      if (!b) return;
      const act = b.dataset.act;
      if (act === "zh-toggle") {
        S.settings.showZh = S.settings.showZh === false ? true : false;
        await saveSettings();
        closeSheet();
        renderChat(false);
        toast(S.settings.showZh ? "已显示中文对照" : "已隐藏中文对照");
      } else if (act === "star-filter") {
        S.onlyStar = !S.onlyStar;
        closeSheet();
        renderChatHeader();
        renderChat(true);
      } else if (act === "edit") {
        closeSheet();
        setTimeout(() => openArtistSheet(S.artist), 240);
      } else if (act === "export") {
        closeSheet();
        const messages = await DB.byIndex("messages", "artistId", a.id);
        downloadJSON({ app: "bubble-archive", artist: a, artistRef: a, messages: messages.map(stripMedia) }, `${a.name}-存档.json`);
        toast("已导出");
      } else if (act === "delete") {
        if (!confirm(`删除「${a.name}」的全部存档？（云端文件不会删除）`)) return;
        const ids = (await DB.byIndex("messages", "artistId", a.id)).map((m) => m.id);
        await DB.delMany("messages", ids);
        await DB.del("artists", a.id);
        closeSheet();
        goHome();
        await reloadAll();
        renderHome();
        toast("已删除");
      }
    });
  }

  /* ---------------- 全局绑定 ---------------- */
  let suppressClick = false;

  function bindGlobal() {
    $("#btnSettings") && ($("#btnSettings").onclick = openSettings);
    $("#btnSync") && ($("#btnSync").onclick = () => syncAll(true));
    $("#btnBack") && ($("#btnBack").onclick = goHome);
    $("#btnSetBack") && ($("#btnSetBack").onclick = goHome);
    $("#btnChatMenu") && ($("#btnChatMenu").onclick = openChatMenu);
    $("#btnCal") && ($("#btnCal").onclick = openCalendar);
    $("#fabAdd") && ($("#fabAdd").onclick = () => openAddSheet(S.artist ? S.artist.id : null));

    const search = $("#searchInput");
    if (search)
      search.addEventListener("input", () => {
        S.q = search.value;
        renderHome();
      });

    // 返回键
    window.addEventListener("popstate", () => {
      if (S.view !== "home") goHome();
    });

    // 首页列表
    const list = $("#chatList");
    list.addEventListener("click", (e) => {
      if (suppressClick) return;
      if (e.target.closest("#btnAddArtist")) return openArtistSheet(null);
      const item = e.target.closest(".chat-item");
      if (item) openChat(item.dataset.id);
    });

    let lpTimer = null;
    const startLP = (sel, cb) => (e) => {
      const el = e.target.closest(sel);
      if (!el) return;
      clearTimeout(lpTimer);
      lpTimer = setTimeout(() => {
        suppressClick = true;
        cb(el);
        setTimeout(() => (suppressClick = false), 400);
      }, 520);
    };
    const stopLP = () => clearTimeout(lpTimer);

    ["pointerdown"].forEach((ev) => {
      list.addEventListener(ev, startLP(".chat-item", (el) => {
        const a = S.artists.find((x) => x.id === el.dataset.id);
        if (a) openArtistSheet(a);
      }));
    });
    ["pointerup", "pointercancel", "pointermove", "pointerleave"].forEach((ev) => list.addEventListener(ev, stopLP));

    // 对话列表内交互
    const msgList = $("#msgList");
    msgList.addEventListener("click", (e) => {
      if (suppressClick) return;
      const btn = e.target.closest('[data-act="open"]');
      if (!btn) return;
      const row = btn.closest(".row-body");
      const m = S.msgs.find((x) => x.id === row.dataset.msg);
      if (m) openViewer(m);
    });

    // 长按图片时不要弹系统"保存图片/查看图片"菜单
    msgList.addEventListener("contextmenu", (e) => {
      if (e.target.closest(".row-body")) e.preventDefault();
    });
    msgList.addEventListener("dragstart", (e) => e.preventDefault());

    let mpTimer = null;
    msgList.addEventListener("pointerdown", (e) => {
      const row = e.target.closest(".row-body");
      if (!row) return;
      clearTimeout(mpTimer);
      mpTimer = setTimeout(() => {
        suppressClick = true;
        const m = S.msgs.find((x) => x.id === row.dataset.msg);
        if (m) openMsgMenu(m);
        setTimeout(() => (suppressClick = false), 500);
      }, 480);
    });
    ["pointerup", "pointercancel", "pointermove", "pointerleave"].forEach((ev) => msgList.addEventListener(ev, () => clearTimeout(mpTimer)));

    // 遮罩关闭
    $("#sheetWrap").addEventListener("click", (e) => {
      if (e.target.matches(".sheet-bg")) closeSheet();
    });

    // 查看器
    $("#vClose").onclick = () => {
      $("#viewer").hidden = true;
      $("#vbody").innerHTML = "";
    };
    $("#vEdit") &&
      ($("#vEdit").onclick = () => {
        if (S.viewerMsg) openEditSheet(S.viewerMsg);
      });
    $("#vDownload").onclick = () => {
      if (S.viewerMsg) fetchAndDownload(S.viewerMsg);
    };
  }

  function goHome() {
    S.view = "home";
    S.artist = null;
    $("#view-chat").hidden = true;
    $("#view-settings").hidden = true;
    $("#view-home").hidden = false;
    clearUrls();
    renderHome();
    updateSyncBadge();
  }

  async function saveSettings() {
    await DB.kvSet("settings", { ...S.settings });
  }

  /* ---------------- 演示数据 ---------------- */
  function demoPhoto(seed) {
    const cv = document.createElement("canvas");
    cv.width = 480;
    cv.height = 600;
    const ctx = cv.getContext("2d");
    const sets = [
      ["#cbb8ff", "#8f7cff", "#5f47c9"],
      ["#ffd9c0", "#f0a8a0", "#c4727a"],
      ["#bfe3ff", "#87b8e8", "#4d7fb5"],
    ][seed % 3];
    const g = ctx.createLinearGradient(0, 0, 480, 600);
    g.addColorStop(0, sets[0]);
    g.addColorStop(0.55, sets[1]);
    g.addColorStop(1, sets[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 480, 600);
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.fillStyle = "#ffffff";
      ctx.arc(80 + i * 90, 120 + (i % 3) * 140, 46 + i * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "600 26px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("示例图片 #" + (seed + 1), 240, 560);
    return new Promise((res) => cv.toBlob((b) => res(b), "image/jpeg", 0.8));
  }

  async function seedDemo() {
    const now = Date.now();
    const daysAgo = (d, h, m) => {
      const t = new Date(now - d * 86400000);
      t.setHours(h, m, 0, 0);
      return t.toISOString();
    };
    const artists = [
      { id: "d1", name: "Yejin", group: "LUMI", createdAt: daysAgo(40, 10, 0), demo: true },
      { id: "d2", name: "Hamin", group: "NOVA", createdAt: daysAgo(20, 10, 0), demo: true },
      { id: "d3", name: "Mia", group: "ASTER", createdAt: daysAgo(6, 10, 0), demo: true },
    ];
    const photos = [await demoPhoto(0), await demoPhoto(1), await demoPhoto(2)];
    const voiceThumb = await placeholderThumb("voice", 14);

    const msgs = [
      ["d1", "artist", "text", "오늘 연습 끝났어! 다리 다 풀렸어 🥲", daysAgo(2, 21, 12), "今天练完舞啦，腿都要断了 🥲"],
      ["d1", "artist", "text", "근데 신곡 안무 진짜 예쁘더라. 너희가 보면 좋아할 거야", daysAgo(2, 21, 13), "不过新歌的编舞真的很好看，等你们看到一定会喜欢的"],
      ["d1", "me", "text", "辛苦啦！记得好好吃饭 🍚", daysAgo(2, 21, 20), "수고했어! 밥 꼭 챙겨 먹어 🍚"],
      ["d1", "artist", "text", "먹었지! 오늘 치킨 먹었어 ㅎㅎ", daysAgo(2, 21, 26), "吃了吃了，今天吃了炸鸡哈哈"],
      ["d1", "artist", "image", "", daysAgo(1, 20, 3)],
      ["d1", "artist", "text", "오늘 하늘 ☁️ 너희한테 보여주려고", daysAgo(1, 20, 4), "今天的天空 ☁️ 拍给你们看"],
      ["d1", "artist", "voice", "", daysAgo(1, 20, 9)],
      ["d1", "artist", "text", "잘 자, 좋은 꿈 꿔 🌙", daysAgo(0, 0, 40), "晚安，做个好梦 🌙"],
      [
        "d1",
        "artist",
        "text",
        "응 .. 불미스럽더라 12년 아이돌인생중 이런 게임은 또 처음 허허~",
        daysAgo(0, 1, 28),
        "嗯…不好意思，12 年爱豆人生中第一次玩这种游戏 呵呵呵~",
        { type: "me", name: "umji", text: "포즈맞추기에서 불미스러운일이 있던뎅ㅋㅋㅋ", textZh: "在摆姿势的时候发生了不愉快的事情。" },
      ],
      ["d2", "artist", "text", "비행기에서 막 일본 도착했어 🇯🇵", daysAgo(1, 9, 15), "在飞机上，刚落地日本 🇯🇵"],
      ["d2", "artist", "image", "", daysAgo(1, 9, 16)],
      ["d2", "artist", "text", "오늘 너무 추운데, 너희 쪽은 어때?", daysAgo(1, 9, 17), "今天好冷，你们那边呢？"],
      ["d2", "me", "text", "北京也降温了，多穿点", daysAgo(1, 10, 2)],
      ["d3", "artist", "text", "여기 처음 남겨보는데 좀 떨려 😳", daysAgo(0, 13, 5), "第一次在这里留言，有点紧张 😳"],
      ["d3", "artist", "text", "앞으로 자주 올게!", daysAgo(0, 13, 6), "以后会常来的！"],
    ];

    const records = msgs.map((m, i) => {
      const base = {
        id: "dm" + i,
        artistId: m[0],
        role: m[1],
        type: m[2],
        text: m[3],
        textZh: m[5] || "",
        quote: m[6] || null,
        sentAt: m[4],
        createdAt: m[4],
        starred: i === 4,
        demo: true,
        syncState: "local",
      };
      if (m[2] === "image") base.media = { thumb: photos[i % 3], full: photos[i % 3], name: "demo.jpg", mime: "image/jpeg", size: 240000, w: 480, h: 600 };
      if (m[2] === "voice")
        base.media = {
          thumb: voiceThumb,
          full: null,
          name: "demo.m4a",
          mime: "audio/mp4",
          size: 0,
          duration: 14,
          waves: [4, 9, 6, 12, 5, 8, 11, 6, 9, 4, 7, 10, 5, 8],
        };
      return base;
    });

    await DB.putMany("artists", artists);
    await DB.putMany("messages", records);
    S.settings.demoSeeded = true;
    await saveSettings();
    await reloadAll();
  }

  /* ---------------- 启动 ---------------- */
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();