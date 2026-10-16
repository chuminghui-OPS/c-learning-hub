(function () {
  "use strict";
  var store = window.StudyState;
  var lessons = window.SEARCH_INDEX || [];
  var progress = store.read("cbook-progress-v1", {});
  var attempts = store.read("cbook-quiz-v1", {});
  var last = store.read("cbook-last-v1", {});
  var current = document.querySelector(".mark-done[data-lesson]");
  if (current) store.write("cbook-last-v1", { id: current.dataset.lesson });

  function text(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }
  function node(tag, value, className) {
    var el = document.createElement(tag);
    if (value) el.textContent = value;
    if (className) el.className = className;
    return el;
  }
  function renderHome() {
    progress = store.read("cbook-progress-v1", {});
    attempts = store.read("cbook-quiz-v1", {});
    last = store.read("cbook-last-v1", {});
    var done = lessons.filter(function (l) { return progress[l.id] === true; }).length;
    text("home-completed", done + " / " + lessons.length);
    var meter = document.getElementById("home-progress");
    if (meter) { meter.max = lessons.length; meter.value = done; }
    text("home-percent", Math.round(done / Math.max(lessons.length, 1) * 100) + "%");
    text("home-review", lessons.filter(function (l) { return attempts[l.id] && attempts[l.id].wrong; }).length);
    var resume = document.getElementById("resume-link");
    if (resume) {
      var next = store.nextLesson(lessons, progress, last.id);
      if (next) {
        resume.href = next.href;
        resume.textContent = done === lessons.length ? "回顾第 01 章" : (last.id || done ? "继续学习 · 第 " : "开始第 ") + next.num + " 章";
        text("resume-caption", next.title);
      }
      document.querySelectorAll("[data-course-status]").forEach(function (el) {
        el.textContent = progress[el.dataset.courseStatus] === true ? "已完成" : "";
      });
      document.getElementById("hide-completed").onchange = function () {
        var checked = this.checked;
        document.querySelectorAll("[data-course-row]").forEach(function (el) { el.hidden = checked && progress[el.dataset.courseRow] === true; });
        document.getElementById("all-done").hidden = !(checked && done === lessons.length);
      };
      document.getElementById("hide-completed").onchange();
    }
  }
  renderHome();
  window.addEventListener("cbook-state-change", renderHome);

  var practice = store.read("cbook-practice-v1", {});
  document.querySelectorAll("[data-practice]").forEach(function (input) {
    input.checked = practice[input.dataset.practice] === true;
    var status = node("span");
    status.setAttribute("role", "status");
    input.parentElement.appendChild(status);
    input.addEventListener("change", function () {
      practice = store.read("cbook-practice-v1", {});
      var previous = practice[input.dataset.practice] === true;
      practice[input.dataset.practice] = input.checked;
      status.textContent = "";
      if (!store.write("cbook-practice-v1", practice)) {
        input.checked = previous;
        status.textContent = " 暂时无法保存";
      }
    });
  });

  var slider = document.getElementById("lab-temp");
  if (slider) {
    function updateLab() {
      var t = Number(slider.value), fan = t > 30, heater = t <= 20;
      text("lab-value", t + " ℃");
      text("lab-fan", "风扇 · " + (fan ? "开" : "关"));
      text("lab-heater", "加热器 · " + (heater ? "开" : "关"));
      text("lab-mode", fan ? "散热" : heater ? "加热" : "待机");
      document.getElementById("lab-fan").classList.toggle("is-on", fan);
      document.getElementById("lab-heater").classList.toggle("is-on", heater);
      text("lab-trace", t + " > 30 → " + (fan ? "真" : "假") + (fan ? "；跳过后续分支" : "；" + t + " <= 20 → " + (heater ? "真" : "假")) + "\nfan = " + Number(fan) + "; heater = " + Number(heater) + ";");
    }
    slider.addEventListener("input", updateLab);
    document.getElementById("lab-check").addEventListener("click", function () {
      var selected = document.querySelector("[name=lab-predict]:checked");
      if (!selected) { text("lab-feedback", "先选择你的预测。"); return; }
      slider.value = 30;
      updateLab();
      text("lab-feedback", (selected.value === "off" ? "正确。" : "再留意一下边界。") + "30 > 30 为假，30 <= 20 也为假，因此两个输出都关闭。");
    });
    updateLab();
  }

  var review = document.getElementById("review-list");
  if (review) {
    var filter = document.getElementById("review-filter");
    function renderReview() {
      attempts = store.read("cbook-quiz-v1", {});
      var items = lessons.filter(function (l) { return l.quiz && (filter.value === "all" || attempts[l.id] && attempts[l.id].wrong); });
      review.replaceChildren();
      text("review-count", items.length + " 道题");
      if (!items.length) {
        review.appendChild(node("h2", "暂时没有待复习的题目"));
        review.appendChild(node("p", "做一次章节测验，或从全部章节题中选一道开始。"));
        var all = node("button", "练习全部章节题", "btn");
        all.type = "button";
        all.addEventListener("click", function () { filter.value = "all"; renderReview(); });
        review.appendChild(all);
      }
      items.forEach(function (lesson) {
        var section = node("section", "", "review-question");
        var link = node("a", "第 " + lesson.num + " 章 · " + lesson.title);
        link.href = lesson.href + "#pass";
        section.appendChild(link);
        section.appendChild(node("h2", lesson.quiz.q));
        var options = node("div", "", "quiz-opts");
        var feedback = node("p", "", "review-feedback");
        feedback.setAttribute("role", "status");
        var retry = node("button", "再做一次", "btn");
        retry.type = "button";
        retry.hidden = true;
        lesson.quiz.options.forEach(function (label, i) {
          var button = node("button", String.fromCharCode(65 + i) + ". " + label, "quiz-opt");
          button.type = "button";
          button.addEventListener("click", function () {
            var correct = i === lesson.quiz.answer;
            Array.from(options.children).forEach(function (b, j) { b.disabled = true; b.classList.toggle("correct", j === lesson.quiz.answer); });
            button.classList.toggle("wrong", !correct);
            attempts = store.read("cbook-quiz-v1", {});
            attempts[lesson.id] = { wrong: !correct, selected: i, at: Date.now() };
            var saved = store.write("cbook-quiz-v1", attempts);
            if (!saved) attempts = store.read("cbook-quiz-v1", {});
            feedback.textContent = (correct ? "回答正确。" : "这道题还需要再巩固。") + lesson.quiz.explain + (saved ? (correct ? " 已移出待复习。" : " 已加入待复习。") : " 记录保存失败。");
            retry.hidden = false;
            var remaining = lessons.filter(function (l) { return attempts[l.id] && attempts[l.id].wrong; }).length;
            text("review-count", filter.value === "wrong" ? "待复习剩余 " + remaining + " 道" : items.length + " 道题");
          });
          options.appendChild(button);
        });
        retry.addEventListener("click", function () {
          Array.from(options.children).forEach(function (b) { b.disabled = false; b.classList.remove("correct", "wrong"); });
          feedback.textContent = "";
          retry.hidden = true;
          options.firstElementChild.focus();
        });
        section.append(options, feedback, retry);
        review.appendChild(section);
      });
    }
    filter.addEventListener("change", renderReview);
    renderReview();
  }
})();
