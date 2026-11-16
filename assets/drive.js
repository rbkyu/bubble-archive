/* Google Drive 上传模块（纯前端，无需服务器）
   使用 Drive API v3 + drive.file 权限（只允许访问本 App 自己创建的文件）
   鉴权用 Google Identity Services 的 token 模式，Access Token 存在内存/sessionStorage
*/
(function (global) {
  const SCOPE = "https://www.googleapis.com/auth/drive.file";
  const FOLDER_MIME = "application/vnd.google-apps.folder";
  const API = "https://www.googleapis.com/drive/v3";
  const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

  let token = null; // { value, exp }
  let clientId = "";
  let tokenClient = null;
  let pendingResolve = null;

  function loadSession() {
    try {
      const raw = sessionStorage.getItem("sb_token");
      if (raw) {
        const t = JSON.parse(raw);
        if (t.exp > Date.now() + 30000) token = t;
      }
    } catch (e) {}
  }

  function saveSession(t) {
    token = t;
    try {
      if (t) sessionStorage.setItem("sb_token", JSON.stringify(t));
      else sessionStorage.removeItem("sb_token");
    } catch (e) {}
  }

  loadSession();

  function ready() {
    return !!(token && token.exp > Date.now() + 15000);
  }

  function ensureGis() {
    return new Promise((resolve, reject) => {
      if (global.google && google.accounts && google.accounts.oauth2) return resolve();
      // 按需加载 Google 登录组件，避免拖慢启动、也避免离线时卡住
      if (!document.getElementById("gisScript")) {
        const s = document.createElement("script");
        s.id = "gisScript";
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        s.defer = true;
        document.head.appendChild(s);
      }
      let n = 0;
      const timer = setInterval(() => {
        if (global.google && google.accounts && google.accounts.oauth2) {
          clearInterval(timer);
          resolve();
        } else if (++n > 60) {
          clearInterval(timer);
          reject(new Error("加载 Google 登录组件失败，请检查网络（大陆网络需要科学上网）"));
        }
      }, 300);
    });
  }

  /* 请求 token。interactive=true 会弹出授权窗口；false 尝试静默刷新 */
  async function requestToken(interactive) {
    await ensureGis();
    return new Promise((resolve, reject) => {
      if (!tokenClient) {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPE,
          callback: (resp) => {
            const done = pendingResolve;
            pendingResolve = null;
            if (resp && resp.access_token) {
              saveSession({
                value: resp.access_token,
                exp: Date.now() + (Number(resp.expires_in || 3600) - 60) * 1000,
              });
              done && done(null, resp.access_token);
            } else {
              done && done(new Error("授权未完成"));
            }
          },
          error_callback: (err) => {
            const done = pendingResolve;
            pendingResolve = null;
            done && done(new Error(err && err.message ? err.message : "授权被取消"));
          },
        });
      }
      pendingResolve = (err, tok) => (err ? reject(err) : resolve(tok));
      try {
        tokenClient.requestAccessToken({ prompt: interactive ? "consent" : "" });
      } catch (e) {
        pendingResolve = null;
        reject(e);
      }
    });
  }

  async function ensureToken(interactive) {
    if (ready()) return token.value;
    try {
      return await requestToken(interactive);
    } catch (e) {
      if (!interactive) return await requestToken(true);
      throw e;
    }
  }

  async function api(path, opts = {}, retry = true) {
    const tok = await ensureToken(true);
    const res = await fetch(API + path, {
      ...opts,
      headers: {
        Authorization: "Bearer " + tok,
        ...(opts.body && !(opts.body instanceof Blob) ? { "Content-Type": "application/json" } : {}),
        ...(opts.headers || {}),
      },
    });
    if (res.status === 401 && retry) {
      saveSession(null);
      return api(path, opts, false);
    }
    return res;
  }

  function escQ(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }

  async function findFolder(name, parentId) {
    // 根目录（parentId 为空）时不能带 in parents 条件，否则查不到已有文件夹
    const q = parentId
      ? `name='${escQ(name)}' and mimeType='${FOLDER_MIME}' and '${parentId}' in parents and trashed=false`
      : `name='${escQ(name)}' and mimeType='${FOLDER_MIME}' and trashed=false`;
    const res = await api(`/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=5`);
    const data = await res.json();
    return data.files && data.files[0] ? data.files[0].id : null;
  }

  async function createFolder(name, parentId) {
    const res = await api(`/files?fields=id`, {
      method: "POST",
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: parentId ? [parentId] : [] }),
    });
    if (!res.ok) throw new Error("创建云端文件夹失败：" + (await res.text()).slice(0, 120));
    return (await res.json()).id;
  }

  async function ensureFolder(name, parentId) {
    const found = await findFolder(name, parentId);
    if (found) return found;
    return createFolder(name, parentId);
  }

  /* 上传文件：小于 5MB 用 multipart，超过用 resumable */
  async function upload(blob, { name, mime, parentId }) {
    const tok = await ensureToken(true);
    const meta = JSON.stringify({ name, parents: parentId ? [parentId] : [] });

    if (blob.size > 5 * 1024 * 1024) {
      const init = await fetch(`${UPLOAD}/files?uploadType=resumable&fields=id`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + tok,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": mime || "application/octet-stream",
          "X-Upload-Content-Length": String(blob.size),
        },
        body: meta,
      });
      if (!init.ok) throw new Error("初始化上传失败：" + (await init.text()).slice(0, 120));
      const loc = init.headers.get("Location");
      const put = await fetch(loc, {
        method: "PUT",
        headers: { "Content-Type": mime || "application/octet-stream" },
        body: blob,
      });
      if (!put.ok) throw new Error("上传失败：" + (await put.text()).slice(0, 120));
      return (await put.json()).id;
    }

    const boundary = "sb_" + Math.random().toString(36).slice(2);
    const body = new Blob(
      [
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
        `--${boundary}\r\nContent-Type: ${mime || "application/octet-stream"}\r\n\r\n`,
        blob,
        `\r\n--${boundary}--`,
      ],
      { type: "multipart/related; boundary=" + boundary }
    );
    const res = await fetch(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
      method: "POST",
      headers: { Authorization: "Bearer " + tok, "Content-Type": body.type },
      body,
    });
    if (!res.ok) throw new Error("上传失败：" + (await res.text()).slice(0, 120));
    return (await res.json()).id;
  }

  /* 删除云端的文件（只能删本 App 创建的；会进 Drive 回收站） */
  async function remove(fileId) {
    const tok = await ensureToken(true);
    const res = await fetch(`${API}/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + tok },
    });
    if (!res.ok && res.status !== 404) {
      let t = "";
      try {
        t = (await res.text()).slice(0, 120);
      } catch (e) {}
      throw new Error("删除云端文件失败：" + (t || res.status));
    }
    return true;
  }

  async function fetchBlob(fileId) {
    const res = await api(`/files/${encodeURIComponent(fileId)}?alt=media`);
    if (!res.ok) throw new Error("读取云端文件失败");
    return await res.blob();
  }

  const Drive = {
    SCOPE,
    ready,
    setClientId(id) {
      clientId = (id || "").trim();
      tokenClient = null;
    },
    getClientId() {
      return clientId;
    },
    signOut() {
      try {
        if (token && global.google && google.accounts && google.accounts.oauth2) {
          google.accounts.oauth2.revoke(token.value);
        }
      } catch (e) {}
      saveSession(null);
    },
    async connect() {
      if (!clientId) throw new Error("请先填写 OAuth 客户端 ID");
      await ensureToken(true);
      return true;
    },
    async ensureFolder(name, parentId) {
      return ensureFolder(name, parentId);
    },
    upload,
    remove,
    fetchBlob,
    async about() {
      const res = await api("/about?fields=user(emailAddress,displayName),storageQuota(usage,limit)");
      return await res.json();
    },
    folderLink(id) {
      return "https://drive.google.com/drive/folders/" + id;
    },
  };

  global.Drive = Drive;
})(window);
