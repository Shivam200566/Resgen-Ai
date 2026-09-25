import axios from "axios"


const api = axios.create({
    baseURL: "http://localhost:3000",
    withCredentials: true
})

function getErrorMessage(err, defaultMessage) {
    if (!err.response) {
        return "Cannot connect to server. Please ensure the backend is running."
    }
    return err.response?.data?.message || defaultMessage
}

export async function register({ username, email, password }) {
    try {
        const response = await api.post('/api/auth/register', {
            username, email, password
        })
        return response.data
    } catch (err) {
        throw new Error(getErrorMessage(err, "Unable to register right now"))
    }
}

export async function login({ email, password }) {
    try {
        const response = await api.post("/api/auth/login", {
            email, password
        })
        return response.data
    } catch (err) {
        throw new Error(getErrorMessage(err, "Invalid email or password"))
    }
}

export async function logout() {
    try {
        const response = await api.post("/api/auth/logout")
        return response.data
    } catch (err) {
        throw new Error(getErrorMessage(err, "Unable to log out right now"))
    }
}

export async function getMe() {
    try {
        const response = await api.get("/api/auth/get-me")
        return response.data
    } catch (err) {
        throw new Error(getErrorMessage(err, "Unable to fetch the current user"))
    }
}