import ReactPDF from "@react-pdf/renderer";

ReactPDF.Font.register({
  family: "Arabic",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/notosanarsbic/v21/nwpPtK2mZAP88bUW5KAe7FVG68LU_Qk2-Q3n.ttf",
      fontWeight: "normal",
    },
    {
      src: "https://fonts.gstatic.com/s/notosanarsbic/v21/nwpTtK2mZAP88bUW5KAe7FVW2sdN6XTL_dw.ttf",
      fontWeight: "bold",
    },
  ],
});

ReactPDF.Font.registerHyphenationCallback((word) => [word]);

// ─── Language helpers ─────────────────────────────────────────────────────────
const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
const isArabic = (text) => ARABIC_RE.test(text ?? "");

// ─── RTL Mark for bidirectional text correction ────────────────────────────────
const RTL_MARK = "\u200F";

// Normalize punctuation: ? → ؟, , → ،, ; → ؛ (for Arabic text only)
const normalizePunctuation = (text) => {
  if (!text) return text;
  const str = String(text);
  if (ARABIC_RE.test(str)) {
    return str.replace(/\?/g, "؟").replace(/,/g, "،").replace(/;/g, "؛");
  }
  return str;
};

// Wrap text with RTL mark for correct visual rendering
const wrapForLocale = (text, isArabic) => {
  if (text === null || text === undefined) return text;
  const normalized = normalizePunctuation(String(text));
  if (isArabic) {
    return `${RTL_MARK}${normalized}${RTL_MARK}`;
  }
  return normalized;
};

// ─── Colour tokens ────────────────────────────────────────────────────────────
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
  white: "#ffffff",
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = ReactPDF.StyleSheet.create({
  page: {
    fontFamily: "Arabic",
    backgroundColor: C.white,
    paddingTop: 50,
    paddingBottom: 70,
    paddingHorizontal: 40,
    fontSize: 12,
    color: C.black,
  },

  headerWrapper: { marginBottom: 30 },
  headerTop: {
    backgroundColor: C.brand,
    paddingVertical: 20,
    paddingHorizontal: 28,
    alignItems: "center",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: C.white,
    textAlign: "center",
    lineHeight: 1.5,
  },
  headerBottom: {
    backgroundColor: C.brandLight,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  headerMeta: {
    fontSize: 10,
    color: C.brandDark,
    fontWeight: "bold",
    textAlign: "center",
  },

  questionCard: {
    marginBottom: 22,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.gray200,
    overflow: "hidden",
  },
  questionHeader: {
    backgroundColor: C.gray50,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.gray200,
  },
  questionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  questionHeaderRowRTL: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  questionBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 5,
    flexShrink: 0,
  },
  questionBadgeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: C.white,
    textAlign: "center",
  },
  questionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "bold",
    color: C.black,
    lineHeight: 1.6,
    paddingTop: 2,
  },
  badgePill: {
    fontSize: 8,
    color: C.white,
    backgroundColor: C.accent,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 10,
    flexShrink: 0,
    marginTop: 4,
  },

  optionsGrid: {
    padding: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
  },
  optionsGridRTL: {
    padding: 12,
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
  },

  optionCard: {
    width: "48%",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.gray200,
    backgroundColor: C.white,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  optionCardCorrect: {
    width: "48%",
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.green,
    backgroundColor: C.greenLight,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },

  optionInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  optionInnerRTL: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 6,
  },

  optionLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: C.brand,
    minWidth: 16,
    textAlign: "center",
    paddingTop: 1,
    flexShrink: 0,
  },
  optionLabelCorrect: {
    fontSize: 10,
    fontWeight: "bold",
    color: C.green,
    minWidth: 16,
    textAlign: "center",
    paddingTop: 1,
    flexShrink: 0,
  },
  optionText: {
    flex: 1,
    fontSize: 11,
    color: C.gray800,
    lineHeight: 1.5,
  },
  optionTextCorrect: {
    flex: 1,
    fontSize: 11,
    color: C.green,
    fontWeight: "bold",
    lineHeight: 1.5,
  },

  tfGrid: {
    padding: 12,
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-start",
  },
  tfGridRTL: {
    padding: 12,
    flexDirection: "row-reverse",
    gap: 10,
    justifyContent: "flex-start",
  },
  tfCard: {
    minWidth: 80,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.gray200,
    backgroundColor: C.white,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  tfCardCorrect: {
    minWidth: 80,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.green,
    backgroundColor: C.greenLight,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  tfText: { fontSize: 11, fontWeight: "bold", color: C.gray800 },
  tfTextCorrect: { fontSize: 11, fontWeight: "bold", color: C.green },

  explanationBox: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 6,
    backgroundColor: C.accentLight,
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  explanationBoxRTL: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 6,
    backgroundColor: C.accentLight,
    borderRightWidth: 3,
    borderRightColor: C.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  explanationLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: C.accent,
    marginBottom: 4,
  },
  explanationText: {
    fontSize: 10,
    color: C.gray600,
    lineHeight: 1.6,
  },

  footer: {
    position: "absolute",
    bottom: 28,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: C.gray200,
    paddingTop: 8,
  },
  footerText: { fontSize: 8, color: C.gray400 },
  pageNumber: { fontSize: 8, color: C.gray400 },
});

// ─── Component ────────────────────────────────────────────────────────────────
export const AcademicExamPDF = ({ exam, questions, showAnswers }) => {
  const titleIsRTL = isArabic(exam.title);

  return (
    <ReactPDF.Document>
      <ReactPDF.Page size="A4" style={S.page}>
        {/* ── Header ── */}
        <ReactPDF.View style={S.headerWrapper}>
          <ReactPDF.View style={S.headerTop}>
            <ReactPDF.Text
              style={[
                S.headerTitle,
                { textAlign: titleIsRTL ? "right" : "center" },
              ]}
            >
              {wrapForLocale(exam.title, titleIsRTL)}
            </ReactPDF.Text>
          </ReactPDF.View>

          <ReactPDF.View style={S.headerBottom}>
            <ReactPDF.Text
              style={[
                S.headerMeta,
                { textAlign: titleIsRTL ? "right" : "center" },
              ]}
            >
              {wrapForLocale(
                titleIsRTL
                  ? `المادة: ${exam.subject ?? "عام"}   |   المدة: ${exam.durationMinutes} دقيقة   |   عدد الأسئلة: ${questions.length}`
                  : `Subject: ${exam.subject ?? "General"}   |   Duration: ${exam.durationMinutes} min   |   Questions: ${questions.length}`,
                titleIsRTL,
              )}
            </ReactPDF.Text>
          </ReactPDF.View>
        </ReactPDF.View>

        {/* ── Questions ── */}
        {questions.map((q, index) => {
          const qRTL = isArabic(q.title);
          const textDir = qRTL ? "right" : "left";
          const isMCQ =
            q.typeQue === "MCQ" &&
            Array.isArray(q.options) &&
            q.options.length > 0;

          return (
            <ReactPDF.View
              key={q._id?.toString() ?? String(index)}
              style={S.questionCard}
              wrap
            >
              {/* ── Question heading ── */}
              <ReactPDF.View style={S.questionHeader}>
                <ReactPDF.View
                  style={qRTL ? S.questionHeaderRowRTL : S.questionHeaderRow}
                >
                  <ReactPDF.View style={S.questionBadge}>
                    <ReactPDF.Text style={S.questionBadgeText}>
                      {index + 1}
                    </ReactPDF.Text>
                  </ReactPDF.View>

                  <ReactPDF.Text
                    style={[S.questionText, { textAlign: textDir }]}
                  >
                    {wrapForLocale(q.title, qRTL)}
                  </ReactPDF.Text>

                  {showAnswers && (
                    <ReactPDF.Text style={S.badgePill}>
                      {q.difficulty} · {q.cognitiveLevel}
                    </ReactPDF.Text>
                  )}
                </ReactPDF.View>
              </ReactPDF.View>

              {/* ── MCQ options ── */}
              {isMCQ ? (
                <ReactPDF.View style={qRTL ? S.optionsGridRTL : S.optionsGrid}>
                  {q.options.map((opt, i) => {
                    const label = String.fromCharCode(65 + i);
                    const isCorrect = showAnswers && opt === q.correctAnswer;
                    const optRTL = isArabic(opt);
                    const optAlign = optRTL ? "right" : "left";

                    return (
                      <ReactPDF.View
                        key={i}
                        style={isCorrect ? S.optionCardCorrect : S.optionCard}
                      >
                        <ReactPDF.View
                          style={optRTL ? S.optionInnerRTL : S.optionInner}
                        >
                          <ReactPDF.Text
                            style={
                              isCorrect ? S.optionLabelCorrect : S.optionLabel
                            }
                          >
                            {label}
                          </ReactPDF.Text>
                          <ReactPDF.Text
                            style={[
                              isCorrect ? S.optionTextCorrect : S.optionText,
                              { textAlign: optAlign },
                            ]}
                          >
                            {wrapForLocale(opt, optRTL)}
                          </ReactPDF.Text>
                        </ReactPDF.View>
                      </ReactPDF.View>
                    );
                  })}
                </ReactPDF.View>
              ) : (
                <ReactPDF.View style={qRTL ? S.tfGridRTL : S.tfGrid}>
                  {["True", "False"].map((val) => {
                    const isCorrect = showAnswers && q.correctAnswer === val;
                    const label = qRTL ? (val === "True" ? "صح" : "خطأ") : val;
                    return (
                      <ReactPDF.View
                        key={val}
                        style={isCorrect ? S.tfCardCorrect : S.tfCard}
                      >
                        <ReactPDF.Text
                          style={isCorrect ? S.tfTextCorrect : S.tfText}
                        >
                          {wrapForLocale(label, qRTL)}
                        </ReactPDF.Text>
                      </ReactPDF.View>
                    );
                  })}
                </ReactPDF.View>
              )}

              {/* ── AI Explanation ── */}
              {showAnswers &&
                q.ai_explanation &&
                (() => {
                  const expRTL = isArabic(q.ai_explanation);
                  return (
                    <ReactPDF.View
                      style={expRTL ? S.explanationBoxRTL : S.explanationBox}
                    >
                      <ReactPDF.Text
                        style={[
                          S.explanationLabel,
                          { textAlign: expRTL ? "right" : "left" },
                        ]}
                      >
                        {wrapForLocale(
                          expRTL ? "الشرح" : "Explanation",
                          expRTL,
                        )}
                      </ReactPDF.Text>
                      <ReactPDF.Text
                        style={[
                          S.explanationText,
                          { textAlign: expRTL ? "right" : "left" },
                        ]}
                      >
                        {wrapForLocale(q.ai_explanation, expRTL)}
                      </ReactPDF.Text>
                    </ReactPDF.View>
                  );
                })()}
            </ReactPDF.View>
          );
        })}

        {/* ── Footer ── */}
        <ReactPDF.View style={S.footer} fixed>
          <ReactPDF.Text style={S.footerText}>
            Powered by Aigentic AI Exam Generator
          </ReactPDF.Text>
          <ReactPDF.Text
            style={S.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </ReactPDF.View>
      </ReactPDF.Page>
    </ReactPDF.Document>
  );
};
