const OpenAI = require("openai")
const { GoogleGenAI } = require("@google/genai")
const puppeteer = require("puppeteer")

function extractJson(text) {
    if (!text) throw new Error("Empty response from AI")
    let cleaned = text.trim()
    
    // 1. Try direct JSON parse
    try {
        return JSON.parse(cleaned)
    } catch (_) {}

    // 2. Try markdown code block ```json ... ``` or ``` ... ```
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    if (codeBlockMatch && codeBlockMatch[1]) {
        try {
            return JSON.parse(codeBlockMatch[1].trim())
        } catch (_) {}
    }

    // 3. Extract between the first '{' and the last '}'
    const firstBrace = cleaned.indexOf("{")
    const lastBrace = cleaned.lastIndexOf("}")
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const potentialJson = cleaned.substring(firstBrace, lastBrace + 1)
        try {
            return JSON.parse(potentialJson)
        } catch (_) {}
    }

    throw new Error(`Failed to parse AI output into JSON: ${cleaned.slice(0, 120)}...`)
}

function normalizeInterviewReport(raw, jobDescription) {
    const report = typeof raw === "object" && raw !== null ? raw : {}

    // 1. Title
    let title = typeof report.title === "string" && report.title.trim() 
        ? report.title.trim() 
        : ""
    if (!title) {
        const firstLine = (jobDescription || "").split("\n")[0].trim().replace(/[#*_-]/g, "")
        title = firstLine.slice(0, 60) || "Target Role Interview Strategy"
    }

    // 2. Match Score
    let matchScore = typeof report.matchScore === "number" ? report.matchScore : 75
    if (isNaN(matchScore) || matchScore < 0) matchScore = 0
    if (matchScore > 100) matchScore = 100

    // 3. Technical Questions
    const rawTech = Array.isArray(report.technicalQuestions) ? report.technicalQuestions : []
    const technicalQuestions = rawTech.map((q, i) => {
        if (typeof q === "string") {
            return {
                question: q,
                intention: "Evaluate domain knowledge and problem-solving approach.",
                answer: "Provide a structured explanation demonstrating core principles and practical examples."
            }
        }
        return {
            question: q?.question || `Technical Question ${i + 1}`,
            intention: q?.intention || "Evaluate domain competency.",
            answer: q?.answer || "Provide a comprehensive, structured response."
        }
    })

    if (technicalQuestions.length === 0) {
        technicalQuestions.push({
            question: "Can you walk through your technical approach and system design decisions for this role?",
            intention: "Evaluate technical foundations and engineering reasoning.",
            answer: "Highlight architectural decisions, relevant tools, and measurable performance impact."
        })
    }

    // 4. Behavioral Questions
    const rawBehav = Array.isArray(report.behavioralQuestions) ? report.behavioralQuestions : []
    const behavioralQuestions = rawBehav.map((q, i) => {
        if (typeof q === "string") {
            return {
                question: q,
                intention: "Assess teamwork, communication, and conflict resolution skills.",
                answer: "Use the STAR method (Situation, Task, Action, Result) with specific past experience."
            }
        }
        return {
            question: q?.question || `Behavioral Question ${i + 1}`,
            intention: q?.intention || "Assess cultural fit and collaboration.",
            answer: q?.answer || "Use the STAR framework with concrete results."
        }
    })

    if (behavioralQuestions.length === 0) {
        behavioralQuestions.push({
            question: "Tell me about a time you worked on a tight deadline or resolved a difficult team challenge.",
            intention: "Assess adaptability, communication, and ownership.",
            answer: "Detail the situation, the actions you took to resolve it, and the successful outcome."
        })
    }

    // 5. Skill Gaps
    const validSeverities = ["low", "medium", "high"]
    const rawGaps = Array.isArray(report.skillGaps) ? report.skillGaps : []
    const skillGaps = rawGaps.map(g => {
        if (typeof g === "string") {
            return { skill: g, severity: "medium" }
        }
        const severity = validSeverities.includes(String(g?.severity).toLowerCase())
            ? String(g.severity).toLowerCase()
            : "medium"
        return {
            skill: g?.skill || "Core Domain Concepts",
            severity
        }
    })

    // 6. Preparation Plan
    const rawPlan = Array.isArray(report.preparationPlan) ? report.preparationPlan : []
    const preparationPlan = rawPlan.map((p, i) => {
        const day = typeof p?.day === "number" ? p.day : i + 1
        const focus = typeof p?.focus === "string" && p.focus.trim()
            ? p.focus.trim()
            : (typeof p === "string" ? p : `Day ${day}: Deep Dive & Practice`)
        
        let tasks = []
        if (Array.isArray(p?.tasks)) {
            tasks = p.tasks.map(t => typeof t === "string" ? t : JSON.stringify(t)).filter(Boolean)
        } else if (typeof p?.tasks === "string") {
            tasks = [p.tasks]
        }
        if (tasks.length === 0) {
            tasks = ["Review core technical concepts and solve relevant practice problems."]
        }

        return { day, focus, tasks }
    })

    if (preparationPlan.length === 0) {
        preparationPlan.push(
            { day: 1, focus: "Foundations & Job Alignment", tasks: ["Review job requirements and key system concepts."] },
            { day: 2, focus: "Hands-on Technical Practice", tasks: ["Practice technical interview questions and scenario walkthroughs."] },
            { day: 3, focus: "Behavioral Prep & Mock Interview", tasks: ["Prepare STAR stories and conduct a mock interview."] }
        )
    }

    return {
        title,
        matchScore,
        technicalQuestions,
        behavioralQuestions,
        skillGaps,
        preparationPlan
    }
}

async function callAiChat(prompt) {
    const openRouterKey = process.env.OPENROUTER_API_KEY
    const googleKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY

    // 1. Google GenAI (if key provided)
    if (googleKey) {
        try {
            const ai = new GoogleGenAI({ apiKey: googleKey })
            const response = await ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json"
                }
            })
            return extractJson(response.text)
        } catch (err) {
            console.error("Google GenAI error:", err.message)
            if (!openRouterKey) {
                throw new Error(`Google Gemini API error: ${err.message}`)
            }
        }
    }

    // 2. OpenRouter (fast, resilient model order)
    if (openRouterKey) {
        const client = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: openRouterKey,
            timeout: 30000,
        })

        const modelsToTry = [
            "openrouter/free",
            "liquid/lfm-2.5-2.6b:free",
            "nvidia/nemotron-3.5-lightning:free",
            "dots-studio/dots-3-note-preview:free",
            "thinkingmachines/inkling:free",
            "qwen/qwen3.8-27b:free"
        ]

        let lastErr = null
        for (const model of modelsToTry) {
            try {
                const response = await client.chat.completions.create({
                    model,
                    messages: [{ role: "user", content: prompt }],
                })
                const text = response.choices[0]?.message?.content
                return extractJson(text)
            } catch (err) {
                console.error(`OpenRouter error with model ${model}:`, err.message)
                lastErr = err
            }
        }
        throw new Error(`OpenRouter generation failed: ${lastErr?.message || "Unknown error"}`)
    }

    throw new Error("No AI API key found. Please set OPENROUTER_API_KEY in your Backend/.env file.")
}

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {
    const prompt = `You are an expert technical interviewer and career strategist.
Analyze the candidate profile against the target job description and generate a complete interview strategy.

Candidate Resume Details:
${resume || "Not provided"}

Self Description:
${selfDescription || "Not provided"}

Target Job Description:
${jobDescription}

Respond strictly with ONLY a JSON object formatted exactly as:
{
  "title": "Concise Role Title",
  "matchScore": 85,
  "technicalQuestions": [
    {
      "question": "The technical question",
      "intention": "Why interviewer asks this",
      "answer": "Detailed structured model answer"
    }
  ],
  "behavioralQuestions": [
    {
      "question": "The behavioral question",
      "intention": "Why interviewer asks this",
      "answer": "Structured response using the STAR method"
    }
  ],
  "skillGaps": [
    {
      "skill": "Name of missing or improvable skill",
      "severity": "medium"
    }
  ],
  "preparationPlan": [
    {
      "day": 1,
      "focus": "Topic of the day",
      "tasks": [
        "Concrete task 1",
        "Concrete task 2"
      ]
    }
  ]
}

Rules:
- "severity" must be strictly one of: "low", "medium", or "high".
- "matchScore" must be a number between 0 and 100.
- Do NOT output any reasoning, preambles, or explanations outside the JSON object.
`

    const rawJson = await callAiChat(prompt)
    return normalizeInterviewReport(rawJson, jobDescription)
}

async function generatePdfFromHtml(htmlContent) {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    })
    const page = await browser.newPage()
    await page.setContent(htmlContent, { waitUntil: "networkidle0" })

    const pdfBuffer = await page.pdf({
        format: "A4",
        margin: {
            top: "20mm",
            bottom: "20mm",
            left: "15mm",
            right: "15mm"
        }
    })

    await browser.close()
    return pdfBuffer
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {
    const prompt = `Generate a modern, professional, ATS-friendly HTML resume for a candidate tailored for the following job description.

Candidate Resume Details:
${resume || "Not provided"}

Self Description:
${selfDescription || "Not provided"}

Target Job Description:
${jobDescription}

Respond ONLY with a valid JSON object strictly matching this format:
{"html": "<!DOCTYPE html><html><head><style>/* CSS styling */</style></head><body>/* Resume HTML */</body></html>"}

Make the HTML resume visually clean, with professional typography, clear sections (Summary, Experience, Skills, Education, Projects), and optimized for A4 printing.
`

    const json = await callAiChat(prompt)
    if (!json.html) throw new Error("AI response did not contain resume HTML")
    return await generatePdfFromHtml(json.html)
}

module.exports = { generateInterviewReport, generateResumePdf }