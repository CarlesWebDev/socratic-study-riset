import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';

if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_evn_key') {
    console.error("API Key gagal dimuat. Pastikan GEMINI_API_KEY ada di file .env");
    process.exit(1);
}

const app = express();
const upload = multer();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

app.use(express.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.get('/', (req, res) => {
    res.json({
        status: 'online',
        name: 'Kronika - World History AI Server',
        version: '1.0.0'
    });
});

app.post('/generate-text', async (req, res) => {
    const { prompt } = req.body;

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt
        });

        res.status(200).json({ result: response.text });
    } catch (error) {
        console.error('generate-text error:', error);
        res.status(500).json({ message: error.message });
    }
});

app.post('/generate-from-image', upload.single('image'), async (req, res) => {
    const { prompt } = req.body;
    const base64Image = req.file?.buffer?.toString('base64');

    if (!base64Image) {
        return res.status(400).json({ message: 'No image file uploaded' });
    }

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                { text: prompt || 'Analyze this historical artifact or image.' },
                { inlineData: { data: base64Image, mimeType: req.file.mimetype } }
            ]
        });

        res.status(200).json({ result: response.text });
    } catch (error) {
        console.error('generate-from-image error:', error);
        res.status(500).json({ message: error.message });
    }
});

app.post('/generate-from-document', upload.single('document'), async (req, res) => {
    const { prompt } = req.body;
    const base64Document = req.file?.buffer?.toString('base64');

    if (!base64Document) {
        return res.status(400).json({ message: 'No document uploaded' });
    }

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                { text: prompt ?? 'Buatkan ringkasan dari dokumen sejarah berikut!', type: 'text' },
                { inlineData: { data: base64Document, mimeType: req.file.mimetype } }
            ]
        });
        res.status(200).json({ result: response.text });
    } catch (error) {
        console.error('generate-from-document error:', error);
        res.status(500).json({ message: error.message });
    }
});

app.post('/generate-from-audio', upload.single('audio'), async (req, res) => {
    const { prompt } = req.body;
    const base64Audio = req.file?.buffer?.toString('base64');

    if (!base64Audio) {
        return res.status(400).json({ message: 'No audio uploaded' });
    }

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                { text: prompt ?? 'Tolong buat transkrip dari rekaman berikut.', type: 'text' },
                { inlineData: { data: base64Audio, mimeType: req.file.mimetype } }
            ]
        });

        res.status(200).json({ result: response.text });
    } catch (error) {
        console.error('generate-from-audio error:', error);
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/chat', async (req, res) => {
    const { conversation } = req.body;

    try {
        if (!Array.isArray(conversation) || conversation.length === 0) {
            return res.status(400).json({ message: 'Conversation must be a non-empty array!' });
        }

        const contents = conversation.map(({ role, text }) => ({
            role: role === 'bot' || role === 'model' || role === 'assistant' ? 'model' : 'user',
            parts: [{ text }]
        }));

        const systemInstruction = '';

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents,
            config: {
                temperature: 0.7,
                systemInstruction
            }
        });

        res.status(200).json({ result: response.text });
    } catch (error) {
        console.error('API /api/chat error:', error);
        res.status(500).json({ message: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Gemini AI Server is running on port http://localhost:${PORT}`));