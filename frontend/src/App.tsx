import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

function App() {
  const navigate = useNavigate()

  useEffect(() => {
    // Redireciona para a dashboard por padrão
    navigate('/admin/dashboard')
  }, [navigate])

  return null
}

export default App
