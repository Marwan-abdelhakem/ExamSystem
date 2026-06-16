import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { llm } from "../Modules/exam/exam.pipeline.js"

export const checkCertificateWithAI = async (fileBuffer, mimeType) => {
    try {
        const base64Image = fileBuffer.toString("base64");

        const prompt = `
You are an expert document verification system. Analyze the uploaded image with extreme strictness.

Your task is to verify if this image is strictly a **Official University Graduation Certificate, Bachelor's/Master's/PhD Degree, or Academic Diploma**.

CRITICAL RULES TO FOLLOW:
1. **Document Type**: It MUST be a formal graduation certificate or degree from a university or college.
2. **Strict Rejection**: Absolutely REJECT and return false for:
   - Certificates of Appreciation or Honor (شهادات التقدير والتكريم).
   - Certificates of Attendance or Participation (شهادات الحضور والمشاركة).
   - Course completion, bootcamps, or training workshop certificates (شهادات الدورات التدريبية).
3. **Official Stamp/Seal Requirement**: The document MUST visibly contain an official governmental or institutional stamp/seal (e.g., ختم النسر, official university ink stamp, or embossed seal). If the document lacks a visible official stamp, it is considered invalid for this system.

Respond with JSON format only (no markdown, no \`\`\`json):
{ "isCertificate": true } -> Only if it is a formal university graduation certificate AND has an official stamp/seal.
{ "isCertificate": false } -> If it is a certificate of appreciation, training, lacks a stamp, or is any other document.
`;

        const response = await llm.invoke([
            new HumanMessage({
                content: [
                    { type: "text", text: prompt },
                    {
                        type: "image_url",
                        image_url: { url: `data:${mimeType};base64,${base64Image}` },
                    },
                ],
            }),
        ]);

        const cleanJsonString = response.content.replace(/```json/g, "").replace(/```/g, "").trim();
        const result = JSON.parse(cleanJsonString);

        return result.isCertificate; 

    } catch (error) {
        console.error("AI Error:", error);
        throw new Error("حصلت مشكلة أثناء فحص الشهادة بالذكاء الاصطناعي");
    }
};