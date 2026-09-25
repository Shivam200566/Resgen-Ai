import { useContext, useEffect } from "react";
import { AuthContext } from "../auth.context";
import { login, register, logout, getMe } from "../services/auth.api";



export const useAuth = () => {

    const context = useContext(AuthContext)
    const { user, setUser, loading, setLoading } = context


    // handleLogin does NOT touch the shared `loading` state.
    // Pages that call this should manage their own `submitting` state.
    const handleLogin = async ({ email, password }) => {
        try {
            const data = await login({ email, password })
            setUser(data.user)
            return data
        } catch (err) {
            throw err
        }
    }

    const handleRegister = async ({ username, email, password }) => {
        try {
            const data = await register({ username, email, password })
            setUser(data.user)
            return data
        } catch (err) {
            throw err
        }
    }

    // Bug #11 fix: errors are no longer silently swallowed.
    // We clear the user locally regardless so the UI always reflects a logged-out state.
    const handleLogout = async () => {
        try {
            await logout()
        } catch (err) {
            console.error("Logout error:", err)
        } finally {
            setUser(null)
        }
    }

    // This is the ONLY place that sets the shared `loading` state.
    // It runs once on app mount to restore the session.
    useEffect(() => {

        const getAndSetUser = async () => {
            try {
                const data = await getMe()
                setUser(data.user)
            } catch (err) { } finally {
                setLoading(false)
            }
        }

        getAndSetUser()

    }, [])

    return { user, loading, handleRegister, handleLogin, handleLogout }
}