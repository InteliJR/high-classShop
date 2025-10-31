import LoginImageMobile from "../../assets/loginCarMobile.png";
import LoginImageDesktop from "../../assets/loginCarDesktop.png";
import {
  useForm,
  type SubmitErrorHandler,
  type SubmitHandler,
} from "react-hook-form";
import { AuthContext } from "../../contexts/AuthContext";
import { useContext, useState, type ChangeEvent } from "react";
import type { LoginValues } from "../../types/types";

export default function Login() {
  // Criação do contexto no navegador
  const auth = useContext(AuthContext);

  // Lógica de submissão do formulário
  // Funções para registrar o input e a submissão do formulário
  const { register, handleSubmit } = useForm<LoginValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  });
  // Estado para o input dos campos de login
  const [input, setInput] = useState<LoginValues>({
    email: "",
    password: "",
  });
  // Submissão das informações dos formulário 
  const onSubmit: SubmitHandler<LoginValues> = () => {
    if (input !== null) {
      auth.login(input);
      return;
    }
    alert("Informações incorretas");
  };
  // Lidar com os erros
  const onError: SubmitErrorHandler<LoginValues> = (errors) =>
    console.log(errors);
  // Lidar com a submissão em partes do input
  const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
    setInput((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className=" sm:absolute w-screen h-screen flex flex-col sm:justify-between sm:items-center sm:flex-row-reverse">
      {/* Imagem */}
      <div className="h-1/3 shrink-0 sm:h-full w-full sm:w-4/7">
        <img
          srcSet={`${LoginImageMobile} 393w, ${LoginImageDesktop} 644w`}
          sizes="(max-width: 393px) 393px, 644px"
          src={LoginImageMobile}
          className="min-w-full h-full object-cover sm:object-cover"
        />
      </div>

      {/* Informações */}
      <div className="sm:relative sm:left-8 flex flex-col gap-7 mx-13 sm:mx-0 sm:rounded-4xl sm:flex-col sm:w-1/2 sm:h-full sm:justify-center sm:gap-23 sm:px-36  sm:inset-y-0 sm:z-10  bg-background">
        {/* Título da página */}
        <div className="sm: relative sm:right-8 pt-8 flex flex-col justify-center items-center gap-3 sm:items-center sm:gap-8">
          <h1 className="text-2xl font-semibold sm:text-center sm:text-6xl">
            Bem-vindo!
          </h1>
          <p className="text-sm text-center font-light sm:text-2xl">
            Entre com suas credenciais para fazer seu agendamento!
          </p>
        </div>
        {/* Campo para preencher as informações */}
        <form
          className=" sm:relative sm:right-8"
          onSubmit={handleSubmit(onSubmit, onError)}
        >
          <div className="flex flex-col gap-6 text-sm sm:text-2xl sm:gap-12">
            <div className="flex flex-col gap-1 sm:gap-2">
              <label about="E-mail">E-mail</label>
              <input
                //about="E-mail"
                alt="Campo para inserir o e-mail"
                type="email"
                name="email"
                placeholder="Insira seu e-mail"
                className="text-xs p-2 sm:p-4 bg bg-color-input rounded-md sm:rounded-xl sm:text-xl"
                {...(register("email"), { required: true })}
                onChange={handleInput}
              />
            </div>
            <div className="flex flex-col gap-1 sm:gap-2">
              <label about="Senha">Senha</label>
              <input
                about="Senha"
                alt="Campo para inserir a senha"
                type="password"
                name="password"
                placeholder="Insira sua senha"
                className="text-xs p-2 sm:p-4 bg bg-color-input rounded-md sm:rounded-xl sm:text-xl"
                {...(register("password"), { required: true })}
                onChange={handleInput}
              />
            </div>
          </div>
          {/* Campo de ações */}
          <div className="flex flex-col justify-center items-center gap-4 text-color-a sm:gap-8 sm:pt-8 pt-4">
            <a className="text-xs text-color-a sm:text-base">
              Esqueceu sua senha?
            </a>
            <input
              type="submit"
              className="text-sm bg-background-secondary p-2 w-full text-color-text-secondary rounded-md sm:text-2xl sm:rounded-lg"
            />
            <a className="text-xs text-color-a sm:text-base">Cadastre-se</a>
          </div>
        </form>
      </div>
    </div>
  );
}
