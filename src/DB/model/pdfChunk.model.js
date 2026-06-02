import mongoose from "mongoose";

const PDFChunkSchema = new mongoose.Schema({
    exam_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true,
    },
    chunk_text: {
        type: String,
        required: true,
    },
    embedding: {
        type: [Number],
        required: true,
    },
});

const PDFChunk = mongoose.models.PDF_Chunk || mongoose.model("PDF_Chunk", PDFChunkSchema);

export default PDFChunk;
