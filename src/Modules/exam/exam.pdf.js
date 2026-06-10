import puppeteer from "puppeteer";
import { examPdfQueue } from "../../Utlis/concurrencyQueue.utlis.js";
import ExamModel from "../../DB/model/exam.model.js";
import QuestionModel from "../../DB/model/question.model.js";

export const downloadExamPDF = async (req, res, next) => {
  const { examId } = req.params;
  const showAnswers = req.query.showAnswers === "true";

  try {
    const exam = await ExamModel.findById(examId);
    if (!exam) return res.status(404).json({ error: "Exam not found." });

    const questions = await QuestionModel.find({ examID: examId });
    let questionsHtml = "";

    questions.forEach((q, index) => {
      let badgeClass = "badge-normal";
      if (q.difficulty === "Easy") badgeClass = "badge-easy";
      if (q.difficulty === "Hard") badgeClass = "badge-hard";

      let optionsHtml = "";
      if (q.typeQue === "MCQ" && q.options) {
        optionsHtml = `<div class="options-grid">${q.options.map((opt, i) => {
          const isCorrect = opt === q.correctAnswer;
          const cls = showAnswers && isCorrect ? "option correct" : "option";
          const radio = showAnswers && isCorrect ? "●" : " ";
          return `<div class="${cls}"><span class="radio-indicator">${radio}</span><span class="option-letter">${String.fromCharCode(65 + i)}</span><span class="option-text">${opt}</span></div>`;
        }).join("")}</div>`;
      } else {
        const isTrueCorrect = q.correctAnswer === "True";
        const isFalseCorrect = q.correctAnswer === "False";
        optionsHtml = `<div class="options-grid">
          <div class="option ${showAnswers && isTrueCorrect ? "correct" : ""}"><span class="radio-indicator">${showAnswers && isTrueCorrect ? "●" : " "}</span><span class="option-text">صح / True</span></div>
          <div class="option ${showAnswers && isFalseCorrect ? "correct" : ""}"><span class="radio-indicator">${showAnswers && isFalseCorrect ? "●" : " "}</span><span class="option-text">خطأ / False</span></div>
        </div>`;
      }

      const explanationHtml = showAnswers && q.ai_explanation
        ? `<div class="ai-explanation"><div class="ai-exp-title">✨ AI Explanation</div><div class="ai-exp-text">${q.ai_explanation}</div></div>` : "";

      questionsHtml += `<div class="question-block">
        <div class="question-title"><span class="question-number">السؤال ${index + 1}:</span> ${q.title}
          ${showAnswers ? `<span class="badge ${badgeClass}">${q.difficulty}</span><span class="badge badge-cognitive">${q.cognitiveLevel}</span>` : ""}
        </div>${optionsHtml}${explanationHtml}
      </div>`;
    });

    const html = `<!DOCTYPE html><html lang="ar"><head><meta charset="UTF-8">
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
      <style>
        body{font-family:'Cairo',sans-serif;padding:10px;color:#1e293b;direction:rtl;text-align:right;background:#fff;font-size:13px}
        .header-container{border:1.5px solid #16305b;border-radius:8px;padding:12px 18px;margin-bottom:20px;background:#f8fafc}
        .exam-title{text-align:center;color:#16305b;font-size:20px;font-weight:bold;margin:0 0 10px;border-bottom:1.5px solid #e2e8f0;padding-bottom:6px}
        .meta-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;font-size:12px;font-weight:bold;color:#475569}
        .student-info-box{display:${showAnswers ? "none" : "grid"};grid-template-columns:2fr 1fr 1fr;gap:15px;margin-top:10px;padding-top:10px;border-top:1px dashed #cbd5e1}
        .info-field{font-size:11px;font-weight:bold;color:#64748b;border-bottom:1px solid #cbd5e1;padding-bottom:2px}
        .question-block{margin-bottom:15px;padding:12px 15px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;page-break-inside:avoid}
        .question-title{font-size:14px;font-weight:bold;margin-bottom:10px;color:#0f172a;line-height:1.5}
        .question-number{color:#16305b;font-size:15px}
        .badge{font-size:9px;padding:1px 8px;border-radius:12px;font-weight:bold;display:inline-block}
        .badge-easy{background:#dcfce7;color:#15803d}.badge-normal{background:#dbeafe;color:#1d4ed8}.badge-hard{background:#ffedd5;color:#c2410c}
        .badge-cognitive{background:#f3e8ff;color:#6b21a8;margin-right:3px}
        .options-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
        .option{display:flex;align-items:center;padding:6px 12px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;background:#f8fafc;gap:8px}
        .option.correct{border-color:#16305b;background:#eff6ff;color:#16305b;font-weight:bold}
        .radio-indicator{width:11px;height:11px;border:1.5px solid #cbd5e1;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;color:#16305b;font-weight:bold;background:#fff}
        .option.correct .radio-indicator{border-color:#16305b}
        .option-letter{font-weight:bold;color:#64748b;margin-left:3px}
        .ai-explanation{margin-top:10px;padding:8px 12px;background:#faf5ff;border-right:3px solid #8b5cf6;border-radius:4px;font-size:11px;color:#5b21b6;line-height:1.5}
        .ai-exp-title{font-weight:bold;font-size:12px;margin-bottom:3px;color:#6b21a8}
        .ai-exp-text{font-weight:500}
      </style></head><body>
      <div class="header-container">
        <h1 class="exam-title">${exam.title}</h1>
        <div class="meta-grid">
          <div>📚 المادة: ${exam.subject || "General Science"}</div>
          <div>⏱️ المدة: ${exam.durationMinutes} دقيقة</div>
          <div>📝 الأسئلة: ${questions.length} أسئلة</div>
        </div>
        <div class="student-info-box">
          <div class="info-field">اسم الطالب: ................................................................</div>
          <div class="info-field">الفصل: ..................</div>
          <div class="info-field">التاريخ: .............</div>
        </div>
      </div>
      <div class="exam-body">${questionsHtml}</div>
    </body></html>`;

    console.log("⏱️ Sending PDF task to Queue...");
    const pdfBuffer = await examPdfQueue.run(async () => {
      const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const buffer = await page.pdf({
        format: "A4", printBackground: true,
        margin: { top: "20mm", right: "20mm", bottom: "25mm", left: "20mm" },
        displayHeaderFooter: true,
        headerTemplate: '<div style="font-size:0px;"></div>',
        footerTemplate: `<div style="font-size:10px;color:#94a3b8;font-family:'Cairo',sans-serif;width:100%;display:flex;justify-content:space-between;padding:0 20mm;box-sizing:border-box;direction:rtl;">
          <span>Aigentic AI Exam Generator</span>
          <span>صفحة <span class="pageNumber"></span> من <span class="totalPages"></span></span>
        </div>`,
      });
      await browser.close();
      return buffer;
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${exam.title.replace(/\s+/g, "_")}_Exam.pdf`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("❌ PDF Generation Failed:", error.message);
    return next(error);
  }
};
