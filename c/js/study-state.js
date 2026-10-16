(function (root) {
  "use strict";
  var KEY = "cbook-state-v2", BACKUP = KEY + "-backup";
  var APP = "c-language-learning-book", LIMIT = 1024 * 1024;
  var fields = { "cbook-progress-v1": "progress", "cbook-quiz-v1": "quiz", "cbook-last-v1": "last", "cbook-practice-v1": "practice" };
  var status = { available: true, readable: true, recovered: false, damaged: false, savedAt: 0, message: "" };
  function object(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function empty() { return { progress: {}, quiz: {}, last: {}, practice: {} }; }
  function lesson(id) { return /^l(?:0[1-9]|1[0-7])$/.test(id); }
  function time(n) { return Number.isSafeInteger(n) && n >= 0; }
  function validate(data) {
    if (!object(data) || Object.keys(data).some(function (k) { return !["progress", "quiz", "last", "practice"].includes(k); })) throw Error("学习数据结构不正确");
    var clean = empty();
    Object.keys(clean).forEach(function (field) { if (!object(data[field])) throw Error("缺少学习数据：" + field); });
    ["progress", "practice"].forEach(function (field) {
      Object.keys(data[field]).forEach(function (id) {
        var valid = field === "progress" ? lesson(id) : /^mcu-(?:[1-9]|1[0-2])$/.test(id);
        if (!valid || typeof data[field][id] !== "boolean") throw Error("完成记录格式不正确");
        clean[field][id] = data[field][id];
      });
    });
    Object.keys(data.quiz).forEach(function (id) {
      var q = data.quiz[id], index = root.SEARCH_INDEX || [];
      var item = index.find(function (l) { return l.id === id; });
      var count = item && item.quiz ? item.quiz.options.length : 4;
      if (!lesson(id) || !object(q) || typeof q.wrong !== "boolean" || !Number.isInteger(q.selected) || q.selected < 0 || q.selected >= count || !time(q.at)) throw Error("测验记录格式不正确");
      clean.quiz[id] = { wrong: q.wrong, selected: q.selected, at: q.at };
    });
    if (Object.keys(data.last).some(function (k) { return k !== "id"; }) || (data.last.id !== undefined && !lesson(data.last.id))) throw Error("最近学习记录不正确");
    if (data.last.id) clean.last.id = data.last.id;
    return clean;
  }
  function decode(raw) {
    if (typeof raw !== "string" || raw.length > LIMIT) throw Error("备份文件过大或格式不正确");
    var value = JSON.parse(raw.replace(/^\uFEFF/, ""));
    if (!object(value) || value.app !== APP || value.version !== 2 || !time(value.savedAt)) throw Error("不是支持的 C 语言学习备份（版本 2）");
    return { app: APP, version: 2, savedAt: value.savedAt, data: validate(value.data) };
  }
  function envelope(data) { return { app: APP, version: 2, savedAt: Date.now(), data: validate(data) }; }
  function notify() {
    if (root.dispatchEvent && root.CustomEvent) root.dispatchEvent(new root.CustomEvent("cbook-state-change"));
  }
  function fail(message) { status.available = false; status.message = message; notify(); return false; }
  function legacy(storage) {
    var data = empty();
    Object.keys(fields).forEach(function (key) {
      try {
        var raw = storage.getItem(key);
        if (raw === null) return;
        var value = JSON.parse(raw), candidate = empty();
        candidate[fields[key]] = value;
        data[fields[key]] = validate(candidate)[fields[key]];
      } catch (_) { status.message = "部分旧记录无法读取，已保留原数据；请导入有效备份。"; }
    });
    return data;
  }
  function load() {
    status.damaged = false;
    try {
      var storage = root.localStorage;
      var raw = storage.getItem(KEY), backup = storage.getItem(BACKUP), result;
      status.readable = true;
      if (raw !== null) {
        try { result = decode(raw); } catch (_) {}
      }
      if (!result && backup !== null) {
        try { result = decode(backup); status.recovered = true; } catch (_) {}
      }
      if (result) { status.savedAt = result.savedAt; return result.data; }
      if (raw !== null || backup !== null) {
        status.damaged = true;
        status.message = "本地记录损坏，已停止自动写入以保护原数据。请用有效备份覆盖恢复。";
        return empty();
      }
      return legacy(storage);
    } catch (_) { status.readable = false; status.available = false; status.message = "浏览器不允许本地存储，本次修改无法保存。请使用普通窗口并允许网站数据。"; return empty(); }
  }
  function persist(data, allowRepair) {
    try {
      load();
      if (status.damaged && !allowRepair) { notify(); return false; }
      var next = envelope(data), storage = root.localStorage;
      var old = storage.getItem(KEY), previous = null;
      try { if (old !== null) previous = JSON.stringify(decode(old)); } catch (_) {}
      // Keep the last valid snapshot. A failed main write must never report success.
      try { if (previous !== null) storage.setItem(BACKUP, previous); } catch (_) {}
      storage.setItem(KEY, JSON.stringify(next));
      if (previous === null) { try { storage.setItem(BACKUP, JSON.stringify(next)); } catch (_) {} }
      status.available = true; status.damaged = false; status.savedAt = next.savedAt; status.message = "";
      notify();
      return true;
    } catch (_) { return fail("保存失败：浏览器存储不可用或空间不足。请导出已有进度，并允许本地存储后重试。"); }
  }
  function read(key, fallback) {
    if (fields[key]) return copy(load()[fields[key]]);
    try { var value = JSON.parse(root.localStorage.getItem(key)); return object(value) ? value : fallback; }
    catch (_) { return fallback; }
  }
  function write(key, value) {
    if (fields[key]) { var data = load(); data[fields[key]] = value; return persist(data, false); }
    try { root.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
  }
  function probe() {
    load();
    if (status.damaged) return false;
    try {
      var key = KEY + "-probe";
      root.localStorage.setItem(key, "1"); root.localStorage.removeItem(key);
      status.available = true;
      return true;
    } catch (_) { return fail("浏览器不允许本地保存，请使用普通窗口并允许网站数据。"); }
  }
  function merge(local, incoming) {
    var result = copy(local);
    ["progress", "practice"].forEach(function (field) {
      Object.keys(incoming[field]).forEach(function (id) { result[field][id] = local[field][id] === true || incoming[field][id] === true; });
    });
    Object.keys(incoming.quiz).forEach(function (id) {
      if (!local.quiz[id] || incoming.quiz[id].at > local.quiz[id].at) result.quiz[id] = incoming.quiz[id];
    });
    if (!result.last.id && incoming.last.id) result.last = incoming.last;
    return result;
  }
  function importBackup(raw, mode) {
    var parsed = decode(raw);
    if (mode !== "merge" && mode !== "replace") throw Error("请选择合并或覆盖恢复");
    var current = load();
    if (status.damaged && mode !== "replace") throw Error("本地记录已损坏，请选择覆盖恢复");
    var next = mode === "replace" ? parsed.data : merge(current, parsed.data);
    if (!persist(next, mode === "replace")) throw Error(status.message || "恢复失败，未写入学习数据");
    return summary(next);
  }
  function summary(data) {
    return { completed: Object.values(data.progress).filter(function (v) { return v === true; }).length,
      wrong: Object.values(data.quiz).filter(function (q) { return q.wrong; }).length,
      practiced: Object.values(data.practice).filter(function (v) { return v === true; }).length };
  }
  function exportBackup() {
    var data = load();
    if (status.damaged || !status.readable) throw Error(status.message || "无法读取本地记录");
    return JSON.stringify(envelope(data), null, 2);
  }
  function nextLesson(index, progress, last) {
    return index.find(function (l) { return l.id === last && progress[l.id] !== true; }) ||
      index.find(function (l) { return progress[l.id] !== true; }) || index[0];
  }
  function parseByte(raw, base) {
    raw = String(raw).trim();
    var valid = base === 16 ? /^(?:0x)?[0-9a-f]+$/i.test(raw) : /^\d+$/.test(raw);
    if (!valid) return null;
    var n = parseInt(raw, base);
    return Number.isSafeInteger(n) && n >= 0 && n <= 255 ? n : null;
  }
  if (root.addEventListener) root.addEventListener("storage", function (event) {
    if (event.key === KEY || event.key === null) { load(); notify(); }
  });
  var api = { read: read, write: write, nextLesson: nextLesson, parseByte: parseByte, probe: probe,
    getStatus: function () { return copy(status); }, exportBackup: exportBackup, importBackup: importBackup,
    previewBackup: function (raw) { var p = decode(raw); return { savedAt: p.savedAt, counts: summary(p.data) }; },
    keys: { primary: KEY, backup: BACKUP } };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.StudyState = api;
})(typeof window !== "undefined" ? window : globalThis);
