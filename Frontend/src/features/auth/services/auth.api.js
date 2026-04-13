import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: true
})

export async function register({username, email, password}) {
  try {
    const response = await api.post("/api/auth/register", {
      username, email, password
    })
    return response.data
  } catch(err){
    console.error('Register error:', err);
    throw err.response?.data || err.message || err;
  }
}

export async function login({email, password}) {
  try {
    const response = await api.post("/api/auth/login", {
      email, password
    })
    return response.data
  } catch(err){
    console.error('Login error:', err);
    throw err.response?.data || err.message || err;
  }
}

export async function logout() {
  try {
    const response = await api.get("/api/auth/logout")
    return response.data
  } catch(err){
    console.error('Logout error:', err);
    throw err.response?.data || err.message || err;
  }
}

export async function getMe() {
  try {
    const response = await api.get("/api/auth/get-me")
    return response.data
  } catch(err){
    console.error('GetMe error:', err);
    throw err.response?.data || err.message || err;
  }
}

export async function generateInterviewReport(data) {
  try {
    const response = await api.post("/api/interview/generate", data);
    return response.data
  } catch(err){
    console.error('Generate report error:', err);
    throw err.response?.data || err.message || err;
  }
}

export async function getUserReports() {
  try {
    const response = await api.get("/api/interview/reports");
    return response.data
  } catch(err){
    console.error('Get reports error:', err);
    throw err.response?.data || err.message || err;
  }
}
