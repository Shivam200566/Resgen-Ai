const pdfParse = require("pdf-parse")
const { generateInterviewReport, generateResumePdf } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")




/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
async function generateInterViewReportController(req, res) {
    try {
        const { selfDescription, jobDescription } = req.body

        if (!jobDescription || !jobDescription.trim()) {
            return res.status(400).json({
                message: "Target job description is required."
            })
        }

        let resumeText = ""
        if (req.file && req.file.buffer) {
            try {
                // pdf-parse v2 API: constructor takes { data, verbosity }, then call .getText()
                const parser = new pdfParse.PDFParse({ data: new Uint8Array(req.file.buffer), verbosity: 0 })
                const result = await parser.getText()
                resumeText = result.text || ""
            } catch (pdfErr) {
                console.error("PDF parsing error:", pdfErr)
                return res.status(400).json({
                    message: "Failed to parse resume PDF. Please ensure it is a valid PDF document."
                })
            }
        }

        if (!resumeText.trim() && (!selfDescription || !selfDescription.trim())) {
            return res.status(400).json({
                message: "Please provide either a resume PDF or a quick self-description."
            })
        }

        const interViewReportByAi = await generateInterviewReport({
            resume: resumeText,
            selfDescription: selfDescription || "",
            jobDescription
        })

        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            resume: resumeText,
            selfDescription: selfDescription || "",
            jobDescription,
            ...interViewReportByAi
        })

        res.status(201).json({
            message: "Interview report generated successfully.",
            interviewReport
        })
    } catch (error) {
        console.error("generateInterViewReportController error:", error)
        const isPermissionDenied = error.status === 403 || error?.error?.code === 403 || error.message?.includes("PERMISSION_DENIED") || error.message?.includes("denied access")
        const statusCode = isPermissionDenied ? 403 : 500
        const message = isPermissionDenied
            ? "Gemini AI access denied (403): Your Gemini API project has been denied access or the API key is restricted. Please check your GOOGLE_GENAI_API_KEY in Backend/.env."
            : (error.message || "Failed to generate interview report.")

        res.status(statusCode).json({
            message
        })
    }
}

/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res) {
    try {
        const { interviewId } = req.params

        const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found."
            })
        }

        res.status(200).json({
            message: "Interview report fetched successfully.",
            interviewReport
        })
    } catch (error) {
        console.error("getInterviewReportByIdController error:", error)
        res.status(500).json({
            message: error.message || "Failed to fetch interview report."
        })
    }
}


/** 
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
    try {
        const interviewReports = await interviewReportModel.find({ user: req.user.id }).sort({ createdAt: -1 }).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

        res.status(200).json({
            message: "Interview reports fetched successfully.",
            interviewReports
        })
    } catch (error) {
        console.error("getAllInterviewReportsController error:", error)
        res.status(500).json({
            message: error.message || "Failed to fetch interview reports."
        })
    }
}


/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res) {
    try {
        const { interviewReportId } = req.params

        const interviewReport = await interviewReportModel.findOne({ _id: interviewReportId, user: req.user.id })

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found."
            })
        }

        const { resume, jobDescription, selfDescription } = interviewReport

        const pdfBuffer = await generateResumePdf({ resume, jobDescription, selfDescription })

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
        })

        res.send(pdfBuffer)
    } catch (error) {
        console.error("generateResumePdfController error:", error)
        res.status(500).json({
            message: error.message || "Failed to generate resume PDF."
        })
    }
}

module.exports = { generateInterViewReportController, getInterviewReportByIdController, getAllInterviewReportsController, generateResumePdfController }