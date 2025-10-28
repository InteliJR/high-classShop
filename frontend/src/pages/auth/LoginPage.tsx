import LoginImage from '../../assets/loginCar.png'

export default function Login() {
    return(
        <div className='w-screen h-screen flex flex-col sm:justify-between'>
            {/* Imagem */}
            <div className='h-1/3'>
                <img 
                src={LoginImage} 
                className='w-full h-full object-none'
                />
            </div>

            {/* Informações */}
            <div className='flex flex-col gap-7 mx-13'> 
                {/* Título da página */}
                <div className='pt-8 flex flex-col justify-center items-center gap-3'>
                    <h1 className='text-2xl font-semibold'>
                        Bem-vindo!
                    </h1>
                    <p className='text-sm text-center font-light'>
                        Entre com suas credenciais para fazer seu agendamento!
                    </p>
                </div>
                {/* Campo para preencher as informações */}
                <div>
                    <div className='flex flex-col gap-6 text-sm'>
                        <div className='flex flex-col gap-1'>
                            <label about="E-mail">E-mail</label>
                            <input 
                                about="E-mail" 
                                alt="Campo para inserir o e-mail" 
                                type="text" 
                                value="Insira seu e-mail"
                                className='text-xs p-2 bg bg-color-input rounded-md text-color-input-text'
                            ></input>
                        </div>
                        <div className='flex flex-col gap-1'>
                            <label about="Senha">Senha</label>
                            <input 
                                about="Senha" 
                                alt="Campo para inserir a senha" 
                                type="text" 
                                value="Insira sua senha"
                                className='text-xs p-2 bg bg-color-input rounded-md text-color-input-text'
                            ></input>
                        </div>
                    </div>
                    {/* Campo de ações */}
                    <div className='pt-4 flex flex-col justify-center items-center gap-4 text-color-a'>
                        <a className='text-xs text-color-a'>Esqueceu sua senha?</a>
                        <button className='text-sm bg-background-secondary p-2 w-full text-color-text-secondary rounded-md'>Entrar</button>
                        <a className='text-xs text-color-a'>Cadastre-se</a>
                    </div>

                </div>
                
            </div>

        </div>
    )

}