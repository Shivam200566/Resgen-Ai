const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")

const app = express()

app.set("trust proxy", 1)
app.use(express.json())
app.use(cookieParser())

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",").map(u => u.trim()) : [])
]

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
            callback(null, true)
        } else {
            callback(null, true)
        }
    },
    credentials: true
}))

/* require all the routes here */
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")

/* using all the routes here */
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)

module.exports = app