(function () {
  "use strict";
  var store = window.StudyState;
  var indicator = document.getElementById("storage-status");
  function status() {
    var state = store.getStatus();
    if (!indicator) return;
    indicator.dataset.error = String(!state.available || state.damaged || state.recovered || !!state.message);
    indicator.textContent = state.message || (state.recovered ? "已从本地副本恢复，请导出备份核对" : state.savedAt ? "已自动保存 · " + new Date(state.savedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "本地自动保存已就绪");
  }
  store.probe();
  status();
  window.addEventListener("cbook-state-change", status);
  var panel = document.getElementById("learning-data");
  if (!panel) return;
  function openPanel() { if (location.hash === "#learning-data") panel.open = true; }
  openPanel();
  window.addEventListener("hashchange", openPanel);
  if (location.protocol === "file:") document.getElementById("storage-hint").textContent = "离线文件模式：不同浏览器对本地文件的保存策略可能不同。请固定浏览器及文件夹位置、勿用无痕模式；移动目录或升级前先导出备份。";
  var feedback = document.getElementById("backup-status"), input = document.getElementById("import-progress");
  var preview = document.getElementById("import-preview"), mode = document.getElementById("import-mode");
  var pending = null, generation = 0;
  function message(text, error) { feedback.textContent = text; feedback.dataset.error = String(!!error); }
  function cancel() { pending = null; generation++; input.value = ""; preview.hidden = true; }
  document.getElementById("export-progress").addEventListener("click", function () {
    try {
      var content = store.exportBackup();
      var url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
      var link = document.createElement("a"), stamp = new Date();
      var date = [stamp.getFullYear(), String(stamp.getMonth() + 1).padStart(2, "0"), String(stamp.getDate()).padStart(2, "0")].join("");
      link.href = url; link.download = "C语言学习进度-" + date + ".json";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      message("已发起备份下载，请确认文件已保存。备份包含进度、测验、错题、实践和最近学习。");
    } catch (error) { message(error.message, true); }
  });
  document.getElementById("choose-backup").addEventListener("click", function () { input.click(); });
  input.addEventListener("change", async function () {
    var file = input.files[0], ticket = ++generation;
    pending = null; preview.hidden = true;
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw Error("文件超过 1 MB，未读取。请选择本应用导出的 JSON 备份。");
      var raw = await file.text();
      if (ticket !== generation) return;
      var info = store.previewBackup(raw), counts = info.counts;
      pending = raw;
      document.getElementById("import-summary").textContent = "备份时间：" + new Date(info.savedAt).toLocaleString("zh-CN") + " · 已完成 " + counts.completed + " 章 / 待复习 " + counts.wrong + " 题 / 实践 " + counts.practiced + " 项";
      mode.value = "merge"; document.getElementById("replace-warning").hidden = true;
      preview.hidden = false;
      message("校验通过。当前数据尚未改动，请确认恢复方式。");
      document.getElementById("confirm-import").focus();
    } catch (error) { if (ticket === generation) message("无法导入：" + error.message, true); }
    finally { if (ticket === generation) input.value = ""; }
  });
  mode.addEventListener("change", function () { document.getElementById("replace-warning").hidden = mode.value !== "replace"; });
  document.getElementById("cancel-import").addEventListener("click", function () { cancel(); message("已取消，当前学习记录未修改。"); });
  document.getElementById("confirm-import").addEventListener("click", function () {
    if (!pending) return;
    try {
      if (mode.value === "replace" && !window.confirm("将用备份覆盖当前学习记录，此操作不能撤销。确定恢复吗？")) return;
      var result = store.importBackup(pending, mode.value);
      cancel();
      message("恢复成功并已保存到本地：已完成 " + result.completed + " 章，待复习 " + result.wrong + " 题，实践 " + result.practiced + " 项。");
    } catch (error) { message("恢复失败：" + error.message, true); }
  });
})();
