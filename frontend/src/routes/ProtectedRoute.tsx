import { useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function ProtectedRoute( {children}: {children: React.ReactNode}) {
    const {user, loading} = useContext(AuthContext);
    const navigate = useNavigate();

    if(loading){
        console.log("Carregando");
        return (
            <div>Carregando</div>
        )
    }

    if(!user) {
        console.log("Sem usuário")
        navigate('/login');
        return
    }

    return children;  

}