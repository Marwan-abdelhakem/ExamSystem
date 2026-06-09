import { jsx, jsxs } from "react/jsx-runtime";
import ReactPDF from "@react-pdf/renderer";
ReactPDF.Font.register({
  family: "Arabic",
  fonts: [
    { src: "C:/Windows/Fonts/arial.ttf", fontWeight: "normal" },
    { src: "C:/Windows/Fonts/arialbd.ttf", fontWeight: "bold" }
  ]
});
ReactPDF.Font.registerHyphenationCallback((word) => [word]);
const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
const isArabic = (text) => ARABIC_RE.test(text ?? "");
const C = {
  brand: "#4f46e5",
  brandLight: "#e0e7ff",
  brandDark: "#312e81",
  accent: "#0ea5e9",
  accentLight: "#e0f2fe",
  green: "#059669",
  greenLight: "#d1fae5",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray400: "#9ca3af",
  gray600: "#4b5563",
  gray800: "#1f2937",
  black: "#111827",
  white: "#ffffff"
};
const S = ReactPDF.StyleSheet.create({
  page: {
    fontFamily: "Arabic",
    backgroundColor: C.white,
    paddingTop: 50,
    paddingBottom: 70,
    paddingHorizontal: 50,
    fontSize: 12,
    color: C.black
  },
  // ── Header
  headerWrapper: { marginBottom: 30 },
  headerTop: {
    backgroundColor: C.brand,
    paddingVertical: 20,
    paddingHorizontal: 28,
    alignItems: "center",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: C.white,
    textAlign: "center",
    lineHeight: 1.5
  },
  headerBottom: {
    backgroundColor: C.brandLight,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10
  },
  headerMeta: {
    fontSize: 10,
    color: C.brandDark,
    fontWeight: "bold",
    textAlign: "center"
  },
  // ── Question card
  questionCard: {
    marginBottom: 22,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.gray200,
    overflow: "hidden"
  },
  // Question header bar
  questionHeader: {
    backgroundColor: C.gray50,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.gray200
  },
  questionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  questionHeaderRowRTL: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10
  },
  questionBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 5,
    flexShrink: 0
  },
  questionBadgeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: C.white,
    textAlign: "center"
  },
  questionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "bold",
    color: C.black,
    lineHeight: 1.6,
    paddingTop: 2
  },
  badgePill: {
    fontSize: 8,
    color: C.white,
    backgroundColor: C.accent,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 10,
    flexShrink: 0,
    marginTop: 4
  },
  // ── MCQ Options grid
  optionsGrid: {
    padding: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  optionsGridRTL: {
    padding: 12,
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8
  },
  optionCard: {
    width: "47%",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.gray200,
    backgroundColor: C.white,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  optionCardCorrect: {
    width: "47%",
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.green,
    backgroundColor: C.greenLight,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  optionInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6
  },
  optionInnerRTL: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 6
  },
  optionLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: C.brand,
    minWidth: 16,
    textAlign: "center",
    paddingTop: 1,
    flexShrink: 0
  },
  optionLabelCorrect: {
    fontSize: 10,
    fontWeight: "bold",
    color: C.green,
    minWidth: 16,
    textAlign: "center",
    paddingTop: 1,
    flexShrink: 0
  },
  optionText: {
    flex: 1,
    fontSize: 11,
    color: C.gray800,
    lineHeight: 1.5
  },
  optionTextCorrect: {
    flex: 1,
    fontSize: 11,
    color: C.green,
    fontWeight: "bold",
    lineHeight: 1.5
  },
  // ── True / False
  tfGrid: {
    padding: 12,
    flexDirection: "row",
    gap: 10
  },
  tfGridRTL: {
    padding: 12,
    flexDirection: "row-reverse",
    gap: 10
  },
  tfCard: {
    minWidth: 80,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.gray200,
    backgroundColor: C.white,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center"
  },
  tfCardCorrect: {
    minWidth: 80,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.green,
    backgroundColor: C.greenLight,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center"
  },
  tfText: { fontSize: 11, fontWeight: "bold", color: C.gray800 },
  tfTextCorrect: { fontSize: 11, fontWeight: "bold", color: C.green },
  // ── AI Explanation
  explanationBox: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 6,
    backgroundColor: C.accentLight,
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  explanationBoxRTL: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 6,
    backgroundColor: C.accentLight,
    borderRightWidth: 3,
    borderRightColor: C.accent,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  explanationLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: C.accent,
    marginBottom: 4
  },
  explanationText: {
    fontSize: 10,
    color: C.gray600,
    lineHeight: 1.6
  },
  // ── Footer
  footer: {
    position: "absolute",
    bottom: 28,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: C.gray200,
    paddingTop: 8
  },
  footerText: { fontSize: 8, color: C.gray400 },
  pageNumber: { fontSize: 8, color: C.gray400 }
});
const AcademicExamPDF = ({ exam, questions, showAnswers }) => {
  const titleIsRTL = isArabic(exam.title);
  return /* @__PURE__ */ jsx(ReactPDF.Document, { children: /* @__PURE__ */ jsxs(ReactPDF.Page, { size: "A4", style: S.page, children: [
    /* @__PURE__ */ jsxs(ReactPDF.View, { style: S.headerWrapper, children: [
      /* @__PURE__ */ jsx(ReactPDF.View, { style: S.headerTop, children: /* @__PURE__ */ jsx(ReactPDF.Text, { style: S.headerTitle, children: exam.title }) }),
      /* @__PURE__ */ jsx(ReactPDF.View, { style: S.headerBottom, children: /* @__PURE__ */ jsx(ReactPDF.Text, { style: S.headerMeta, children: titleIsRTL ? `\u0627\u0644\u0645\u0627\u062F\u0629: ${exam.subject ?? "\u0639\u0627\u0645"}   |   \u0627\u0644\u0645\u062F\u0629: ${exam.durationMinutes} \u062F\u0642\u064A\u0642\u0629   |   \u0639\u062F\u062F \u0627\u0644\u0623\u0633\u0626\u0644\u0629: ${questions.length}` : `Subject: ${exam.subject ?? "General"}   |   Duration: ${exam.durationMinutes} min   |   Questions: ${questions.length}` }) })
    ] }),
    questions.map((q, index) => {
      const qRTL = isArabic(q.title);
      const textDir = qRTL ? "right" : "left";
      const isMCQ = q.typeQue === "MCQ" && Array.isArray(q.options) && q.options.length > 0;
      return /* @__PURE__ */ jsxs(
        ReactPDF.View,
        {
          style: S.questionCard,
          wrap: false,
          children: [
            /* @__PURE__ */ jsx(ReactPDF.View, { style: S.questionHeader, children: /* @__PURE__ */ jsxs(ReactPDF.View, { style: qRTL ? S.questionHeaderRowRTL : S.questionHeaderRow, children: [
              /* @__PURE__ */ jsx(ReactPDF.View, { style: S.questionBadge, children: /* @__PURE__ */ jsx(ReactPDF.Text, { style: S.questionBadgeText, children: index + 1 }) }),
              /* @__PURE__ */ jsx(ReactPDF.Text, { style: [S.questionText, { textAlign: textDir }], children: q.title }),
              showAnswers && /* @__PURE__ */ jsxs(ReactPDF.Text, { style: S.badgePill, children: [
                q.difficulty,
                " \xB7 ",
                q.cognitiveLevel
              ] })
            ] }) }),
            isMCQ ? /* @__PURE__ */ jsx(ReactPDF.View, { style: qRTL ? S.optionsGridRTL : S.optionsGrid, children: q.options.map((opt, i) => {
              const label = String.fromCharCode(65 + i);
              const isCorrect = showAnswers && opt === q.correctAnswer;
              const optRTL = isArabic(opt);
              const optAlign = optRTL ? "right" : "left";
              return /* @__PURE__ */ jsx(
                ReactPDF.View,
                {
                  style: isCorrect ? S.optionCardCorrect : S.optionCard,
                  children: /* @__PURE__ */ jsxs(ReactPDF.View, { style: optRTL ? S.optionInnerRTL : S.optionInner, children: [
                    /* @__PURE__ */ jsx(ReactPDF.Text, { style: isCorrect ? S.optionLabelCorrect : S.optionLabel, children: label }),
                    /* @__PURE__ */ jsx(
                      ReactPDF.Text,
                      {
                        style: [
                          isCorrect ? S.optionTextCorrect : S.optionText,
                          { textAlign: optAlign }
                        ],
                        children: opt
                      }
                    )
                  ] })
                },
                i
              );
            }) }) : (
              /* ── True / False ── */
              /* @__PURE__ */ jsx(ReactPDF.View, { style: qRTL ? S.tfGridRTL : S.tfGrid, children: ["True", "False"].map((val) => {
                const isCorrect = showAnswers && q.correctAnswer === val;
                const label = qRTL ? val === "True" ? "\u0635\u062D" : "\u062E\u0637\u0623" : val;
                return /* @__PURE__ */ jsx(ReactPDF.View, { style: isCorrect ? S.tfCardCorrect : S.tfCard, children: /* @__PURE__ */ jsx(ReactPDF.Text, { style: isCorrect ? S.tfTextCorrect : S.tfText, children: label }) }, val);
              }) })
            ),
            showAnswers && q.ai_explanation && (() => {
              const expRTL = isArabic(q.ai_explanation);
              return /* @__PURE__ */ jsxs(ReactPDF.View, { style: expRTL ? S.explanationBoxRTL : S.explanationBox, children: [
                /* @__PURE__ */ jsx(ReactPDF.Text, { style: [S.explanationLabel, { textAlign: expRTL ? "right" : "left" }], children: expRTL ? "\u0627\u0644\u0634\u0631\u062D" : "Explanation" }),
                /* @__PURE__ */ jsx(ReactPDF.Text, { style: [S.explanationText, { textAlign: expRTL ? "right" : "left" }], children: q.ai_explanation })
              ] });
            })()
          ]
        },
        q._id?.toString() ?? String(index)
      );
    }),
    /* @__PURE__ */ jsxs(ReactPDF.View, { style: S.footer, fixed: true, children: [
      /* @__PURE__ */ jsx(ReactPDF.Text, { style: S.footerText, children: "Powered by Aigentic AI Exam Generator" }),
      /* @__PURE__ */ jsx(
        ReactPDF.Text,
        {
          style: S.pageNumber,
          render: ({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`
        }
      )
    ] })
  ] }) });
};
export {
  AcademicExamPDF
};
