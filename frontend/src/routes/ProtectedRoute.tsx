import { useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function ProtectedRoute( {children}: {children: React.ReactNode}) {
    const {user, loading} = useContext(AuthContext);
    const navigate = useNavigate();

    // Mostrar a tela de carregamento caso esteja carregando conteúdos de acordo com o authContext
    if(loading){
        return (
            <div>Carregando</div>
        )
    }

    // Redirecionar para a tela de login 
    if(!user) {
        navigate('/login');
        return
    }

    return children;  

}