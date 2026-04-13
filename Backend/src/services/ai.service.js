const axios = require('axios');

const invokeUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
const stream = false;

require('dotenv').config();

const headers = {
  Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
};
async function generateReport({ resume, selfDescription, jobDescription, mlContext }) {
  const mlSection = mlContext ? `\n${mlContext}\n` : '';

  const prompt = `
You are an AI that generates structured interview reports.

Return ONLY valid JSON. No explanation. No markdown.

STRICT RULES:
- All keys must be in double quotes
- All strings must be in double quotes
- No trailing commas
- Follow the schema EXACTLY
"matchScore": number between 0 and 100 (integer)
- Generate at least 5 technical questions
- Generate at least 5 behavioral questions
- **CRITICAL**: YOU MUST include the "answer" field (what the ideal answer should be) and the "intention" field for EVERY question you generate. Do NOT omit them!
- At least 10 day preparation plan
${mlSection}
Schema:
{
  "jobDescription": string,
  "resume": string,
  "selfDescription": string,
  "matchScore": number,
  "technicalQuestions": [
    {
      "question": "What is the event loop?",
      "intention": "To test async knowledge",
      "answer": "The event loop is a queue that handles async callbacks."
    }
  ],
  "behavioralQuestions": [
    {
      "question": "Tell me about a time you failed.",
      "intention": "To test resilience",
      "answer": "The candidate should share a specific failure, taking accountability."
    }
  ],
  "skillGaps": [
    {
      "skill": "React",
      "severity": "medium"
    }
  ],
  "preparationPlan": [
    {
      "day": 1,
      "focus": "React Basics",
      "tasks": ["Review hooks", "Build a small app"]
    }
  ]
}

DATA:
Resume:
${resume}

Self Description:
${selfDescription}

Job Description:
${jobDescription}
`;

  const payload = {
    model: "meta/llama3-70b-instruct",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2000,
    temperature: 0.3,
    top_p: 0.9,
    stream: false,
  };

  try {
    const response = await axios.post(invokeUrl, payload, { headers });

    const raw = response.data.choices[0].message.content;

    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}") + 1;

    if (start === -1 || end === -1) {
      throw new Error("Invalid JSON response from AI");
    }

    const jsonString = raw.slice(start, end);
    const parsed = JSON.parse(jsonString);

    // Sanitize missing fields to prevent strict Mongoose schema validation failures
    if (parsed.technicalQuestions && Array.isArray(parsed.technicalQuestions)) {
      parsed.technicalQuestions = parsed.technicalQuestions.map(q => ({
        ...q,
        answer: q.answer || q.modelAnswer || q.expectedAnswer || "Answer not provided by AI.",
        intention: q.intention || q.purpose || "Intention not provided by AI."
      }));
    }

    if (parsed.behavioralQuestions && Array.isArray(parsed.behavioralQuestions)) {
      parsed.behavioralQuestions = parsed.behavioralQuestions.map(q => ({
        ...q,
        answer: q.answer || q.modelAnswer || q.expectedAnswer || "Answer not provided by AI.",
        intention: q.intention || q.purpose || "Intention not provided by AI."
      }));
    }
    console.log(parsed)
    return parsed;
  } catch (error) {
    throw new Error("AI Service Error: " + (error.response?.data?.message || error.message));
  }
}

module.exports = { generateReport };
