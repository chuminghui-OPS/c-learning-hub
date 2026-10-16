/* Multi-page book behavior: theme, sidebar, search, progress, quiz, tools */
(function () {
  "use strict";

  var PROGRESS_KEY = "cbook-progress-v1";
  var THEME_KEY = "cbook-theme";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function loadProgress() {
    return StudyState.read(PROGRESS_KEY, {});
  }
  function saveProgress(p) {
    if (!StudyState.write(PROGRESS_KEY, p)) {
      var el = $("#side-progress");
      if (el) el.textContent = "浏览器未允许保存，进度未写入";
      return false;
    }
    return true;
  }

  function isChapterPath() {
    return /\/chapters\//.test(location.pathname) || /chapters\//.test(location.pathname);
  }
  function prefix() {
    return isChapterPath() ? "../" : "";
  }

  /* theme */
  function initTheme() {
    var saved;
    try { saved = localStorage.getItem(THEME_KEY); } catch (_) {}
    if (saved === "dark" || saved === "light") {
      document.documentElement.setAttribute("data-theme", saved);
    }
    var btn = $("#btn-theme");
    if (btn) {
      btn.addEventListener("click", function () {
        var cur =
          document.documentElement.getAttribute("data-theme") === "dark"
            ? "light"
            : "dark";
        document.documentElement.setAttribute("data-theme", cur);
        try { localStorage.setItem(THEME_KEY, cur); } catch (_) {}
      });
    }
  }

  /* sidebar mobile */
  function closeSidebar() {
    var sb = $("#sidebar");
    var bd = $("#backdrop");
    if (sb) sb.classList.remove("open");
    if (bd) bd.hidden = true;
    var menu = $("#btn-menu");
    if (menu) menu.setAttribute("aria-expanded", "false");
    if (sb && window.matchMedia("(max-width: 900px)").matches) sb.inert = true;
  }
  function openSidebar() {
    var sb = $("#sidebar");
    var bd = $("#backdrop");
    if (sb) sb.classList.add("open");
    if (bd) bd.hidden = false;
    if (sb) sb.inert = false;
    var menu = $("#btn-menu");
    if (menu) menu.setAttribute("aria-expanded", "true");
    var first = sb && sb.querySelector("a");
    if (first) first.focus();
  }
  function initSidebar() {
    var menu = $("#btn-menu");
    var bd = $("#backdrop");
    if (menu) {
      menu.addEventListener("click", function () {
        var sb = $("#sidebar");
        if (sb && sb.classList.contains("open")) closeSidebar();
        else openSidebar();
      });
    }
    if (bd) bd.addEventListener("click", closeSidebar);
    function syncSidebar() {
      var sb = $("#sidebar");
      if (!sb) return;
      if (!window.matchMedia("(max-width: 900px)").matches) { closeSidebar(); sb.inert = false; }
      else sb.inert = !sb.classList.contains("open");
    }
    syncSidebar();
    window.addEventListener("resize", syncSidebar);
    document.addEventListener("keydown", function (event) {
      var sb = $("#sidebar");
      if (!sb || !sb.classList.contains("open")) return;
      if (event.key === "Escape") { closeSidebar(); menu.focus(); }
      if (event.key === "Tab" && window.matchMedia("(max-width: 900px)").matches) {
        var links = $all("a", sb), first = links[0], last = links[links.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    $all(".book-sidebar a").forEach(function (a) {
      a.addEventListener("click", function () {
        if (window.matchMedia("(max-width: 900px)").matches) closeSidebar();
      });
    });
  }

  /* progress UI */
  function updateProgressUI() {
    var p = loadProgress();
    var ids = (window.SEARCH_INDEX || []).filter(function (l) { return p[l.id] === true; });
    var total = (window.SEARCH_INDEX || []).length || 17;
    var pct = Math.round((ids.length / total) * 100);
    var el = $("#side-progress");
    if (el) el.textContent = pct + "% · " + ids.length + "/" + total + " 章完成";
    $all(".ch-link[data-lesson]").forEach(function (a) {
      var id = a.getAttribute("data-lesson");
      a.classList.toggle("done", p[id] === true);
    });
    $all(".mark-done[data-lesson]").forEach(function (btn) {
      var id = btn.getAttribute("data-lesson");
      btn.classList.toggle("done", p[id] === true);
      btn.setAttribute("aria-pressed", String(p[id] === true));
      btn.textContent = p[id] === true ? "已完成本章 ✓" : "标记为已完成";
    });
  }

  function initMarkDone() {
    $all(".mark-done[data-lesson]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-lesson");
        var p = loadProgress();
        if (p[id] === true) {
          delete p[id];
        } else {
          p[id] = true;
        }
        if (saveProgress(p)) updateProgressUI();
        else {
          updateProgressUI();
          btn.textContent = "保存失败，重试";
        }
      });
    });
  }

  /* search — resolve paths relative to current page */
  function searchHref(href) {
    return prefix() + href;
  }

  function initSearch() {
    var input = $("#search-input");
    var box = $("#search-results");
    if (!input || !box) return;
    var index = window.SEARCH_INDEX || [];

    function hide() {
      box.hidden = true;
      box.innerHTML = "";
    }

    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      if (!q) {
        hide();
        return;
      }
      var hits = index.filter(function (item) {
        var blob =
          (item.title + " " + item.num + " " + item.module + " " + (item.goals || []).join(" ") + " " + (item.text || ""))
            .toLowerCase();
        return blob.indexOf(q) !== -1;
      }).slice(0, 8);
      box.hidden = false;
      if (!hits.length) {
        box.innerHTML = '<div class="search-item">没有匹配</div>';
        return;
      }
      box.innerHTML = hits
        .map(function (item) {
          return (
            '<a class="search-item" href="' +
            searchHref(item.href) +
            '"><span class="sm">' +
            item.module +
            "</span>" +
            item.num +
            " · " +
            item.title +
            "</a>"
          );
        })
        .join("");
    });

    document.addEventListener("pointerdown", function (e) {
      var wrap = e.target.closest ? e.target.closest(".search-wrap") : null;
      if (!wrap) hide();
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hide();
      if (e.key === "ArrowDown" && !box.hidden) {
        var link = box.querySelector("a");
        if (link) { e.preventDefault(); link.focus(); }
      }
    });
    box.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { hide(); input.focus(); }
    });
  }

  /* quiz */
  function initQuiz() {
    $all("[data-quiz]").forEach(function (box) {
      var answer = Number(box.getAttribute("data-answer"));
      var fb = $("[data-fb]", box);
      var explain = $("[data-explain]", box);
      var retry = $(".quiz-retry", box);
      if (retry) retry.addEventListener("click", function () {
        $all(".quiz-opt", box).forEach(function (b) { b.disabled = false; b.classList.remove("correct", "wrong"); });
        fb.className = "quiz-fb";
        fb.textContent = "";
        explain.hidden = true;
        retry.hidden = true;
        $(".quiz-opt", box).focus();
      });
      $all(".quiz-opt", box).forEach(function (btn) {
        btn.addEventListener("click", function () {
          var i = Number(btn.getAttribute("data-opt"));
          $all(".quiz-opt", box).forEach(function (b) {
            b.disabled = true;
            if (Number(b.getAttribute("data-opt")) === answer) b.classList.add("correct");
          });
          if (i !== answer) btn.classList.add("wrong");
          if (fb) {
            fb.classList.add("show", i === answer ? "ok" : "no");
            fb.textContent = i === answer ? "回答正确。" : "不对，看高亮选项与解析。";
          }
          if (explain) explain.hidden = false;
          if (retry) retry.hidden = false;
          var id = box.getAttribute("data-quiz-id");
          if (id) {
            var attempts = StudyState.read("cbook-quiz-v1", {});
            attempts[id] = { wrong: i !== answer, selected: i, at: Date.now() };
            if (!StudyState.write("cbook-quiz-v1", attempts) && fb) fb.textContent += " 浏览器未允许保存，本次结果未记录。";
          }
        });
      });
    });
  }

  /* copy */
  function initCopy() {
    $all("[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var wrap = btn.parentElement;
        var code = wrap ? wrap.querySelector("pre code") : null;
        var text = code ? code.textContent : "";
        function done(msg) {
          btn.textContent = msg;
          setTimeout(function () {
            btn.textContent = "复制";
          }, 1200);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(
            function () { done("已复制"); },
            function () { done("失败"); }
          );
        } else {
          done("失败");
        }
      });
    });
  }

  /* tools */
  function toBits(n) {
    return (n & 0xff).toString(2).padStart(8, "0");
  }

  function initTools() {
    var bitRun = $("#bit-run");
    if (bitRun) {
      bitRun.addEventListener("click", function () {
        var a = StudyState.parseByte($("#bit-a").value, 10);
        var b = StudyState.parseByte($("#bit-b").value, 10);
        var op = $("#bit-op").value;
        if (a === null || (["and", "or", "xor"].indexOf(op) !== -1 && b === null)) {
          $("#bit-out").textContent = "请输入 0～255 的整数，不接受小数或超范围数值。";
          $("#bit-bits").textContent = "";
          return;
        }
        var r = 0;
        if (op === "and") r = a & b;
        else if (op === "or") r = a | b;
        else if (op === "xor") r = a ^ b;
        else if (op === "not") r = ~a & 0xff;
        else if (op === "shl") r = (a << 1) & 0xff;
        else if (op === "shr") r = (a >> 1) & 0xff;
        r &= 0xff;
        var bits = $("#bit-bits");
        if (bits) {
          bits.innerHTML = toBits(r)
            .split("")
            .map(function (ch) {
              return '<span class="' + (ch === "1" ? "on" : "") + '">' + ch + "</span>";
            })
            .join("");
        }
        var out = $("#bit-out");
        if (out) {
          out.textContent =
            "A=" +
            a +
            " B=" +
            b +
            " op=" +
            op +
            "\nresult=" +
            r +
            "  0x" +
            r.toString(16).toUpperCase().padStart(2, "0") +
            "  0b" +
            toBits(r);
        }
      });
      $("#bit-op").addEventListener("change", function () {
        $("#bit-b").disabled = ["not", "shl", "shr"].indexOf(this.value) !== -1;
      });
      bitRun.click();
    }
    var cvRun = $("#cv-run");
    if (cvRun) {
      cvRun.addEventListener("click", function () {
        var raw = ($("#cv-in").value || "").trim();
        var base = $("#cv-base").value;
        var n = StudyState.parseByte(raw, Number(base));
        var out = $("#cv-out");
        if (!out) return;
        if (n === null) {
          out.textContent = "请输入有效的 8 位整数：十进制 0～255，或十六进制 00～FF。";
          return;
        }
        out.textContent =
          "DEC " +
          n +
          "\nHEX 0x" +
          n.toString(16).toUpperCase().padStart(2, "0") +
          "\nBIN 0b" +
          toBits(n);
      });
      cvRun.click();
    }
  }

  function loadSearchIndex() {
    if (window.SEARCH_INDEX) return;
    var s = document.createElement("script");
    s.src = prefix() + "js/search-index.js";
    document.head.appendChild(s);
  }

  window.addEventListener("cbook-state-change", updateProgressUI);

  function init() {
    initTheme();
    initSidebar();
    loadSearchIndex();
    initSearch();
    initMarkDone();
    updateProgressUI();
    initQuiz();
    initCopy();
    initTools();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
