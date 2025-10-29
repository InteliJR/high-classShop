import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

function App() {
  const navigate = useNavigate()

  useEffect(() => {
    // Redireciona para a página de companies por padrão
    navigate('/admin/companies')
  }, [navigate])

  return null
}

export default App
