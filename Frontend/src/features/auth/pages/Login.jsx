import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import "../auth.form.scss"
import { useAuth } from '../hooks/useAuth'

const Login = () => {

    const { loading, handleLogin } = useAuth()
    const navigate = useNavigate()

    const [ email, setEmail ] = useState("")
    const [ password, setPassword ] = useState("")
    const [ error, setError ] = useState("")
    // Bug #9 fix: separate submitting state so the form stays visible during submission
    const [ submitting, setSubmitting ] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")
        setSubmitting(true)
        try {
            await handleLogin({ email, password })
            navigate('/')
        } catch (err) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    // Only show the loading screen during the initial session check (app mount)
    if (loading) {
        return (<main><h1>Loading.......</h1></main>)
    }


    return (
        <main>
            <div className="form-container">
                <h1>Login</h1>
                {error && <p role="alert">{error}</p>}
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        {/* Bug #7 fix: added value prop to make input controlled */}
                        <input
                            value={email}
                            onChange={(e) => { setEmail(e.target.value) }}
                            type="email" id="email" name='email' placeholder='Enter email address' autoComplete="email" required />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        {/* Bug #7 fix: added value prop to make input controlled */}
                        <input
                            value={password}
                            onChange={(e) => { setPassword(e.target.value) }}
                            type="password" id="password" name='password' placeholder='Enter password' autoComplete="current-password" required />
                    </div>
                    {/* Bug #8 fix: added type="submit" */}
                    <button type="submit" className='button primary-button' disabled={submitting}>
                        {submitting ? 'Logging in...' : 'Login'}
                    </button>
                </form>
                <p>Don't have an account? <Link to={"/register"} >Register</Link> </p>
            </div>
        </main>
    )
}

export default Login