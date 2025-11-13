import {
  ChevronDown,
  Search,
  TextAlignJustifyIcon,
  UserCircle2,
} from "lucide-react";
import Logo from "../assets/logo_brokerage.png";
import { useState } from "react";
import { useIsMobile } from "../hooks/use-is-mobile";
import { useAuth } from "../store/authStateManager";

export default function Header() {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const { user } = useAuth();

  return (
    <>
      <header
        className="w-full flex h-24 bg-background-secondary text-white
          justify-end items-center px-6 sm:px-18"
      >
        <div className="flex w-full justify-between sm:flex-row-reverse items-center">
          {isMobile ? (
            // Abrir a sidebar do header em mobiles
            <TextAlignJustifyIcon
              size={35}
              onClick={() => {
                setOpen(!open);
              }}
            />
          ) : (
            !user && (
              <div className="flex justify-between items-center text-base w-full pl-12">
                {/* Navegação nos links */}
                <nav>
                  <ul className="flex gap-2">
                    <li className="flex items-center p-2 gap-0.5">
                      <a>Sobre nós</a>
                      <ChevronDown size={20} />
                    </li>
                    <li className="flex items-center p-2 gap-0.5">
                      <a>Aeronave</a>
                      <ChevronDown size={20} />
                    </li>
                    <li className="flex items-center p-2 gap-0.5">
                      <a>Barco</a>
                      <ChevronDown size={20} />
                    </li>
                    <li className="flex items-center p-2 gap-0.5">
                      <a>Carro</a>
                      <ChevronDown size={20} />
                    </li>
                  </ul>
                </nav>
                <button className="flex p-2 gap-3 bg-white text-black rounded-md">
                  <UserCircle2 size={25} />
                  Login
                </button>
              </div>
            )
          )}

          {/* Barra de pesquisa para quando tiver um usuário logado */}
          {user ? (
            <div className="flex sm:justify-around sm:w-full">
              <div className="flex justify-center items-center sm:w-full">
                <div className="relative flex items-center">
                  <Search
                    size={18}
                    className="absolute translate-x-3 text-black"
                  />
                </div>
                <input
                  className=" bg-white rounded-full w-2/3 h-10 text-black px-10"
                  type="text"
                />
              </div>
              <button>
                <UserCircle2 size={40} />
              </button>
            </div>
          ) : (
            <img src={Logo} className="w-25 sm:w-35 h-auto" />
          )}
        </div>
      </header>

      <aside
        className={`${
          open ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
        }  w-2/5  transition-normal ease-out duration-300 flex flex-col text-black justify-between bg-white text-xs gap-4 h-screen fixed z-3 top-0`}
      >
        <div className="flex flex-col">
          <button
            className="p-4 self-end"
            onClick={() => {
              setOpen(!open);
            }}
          >
            {/* Fechar a sidebar em mobiles*/}
            <TextAlignJustifyIcon size={27} />
          </button>

          {/* Navegação nos links */}
          <nav className="pl-7 flex flex-col">
            <ul className="flex flex-col gap-2">
              <li>
                <a className="p-2">Sobre nós</a>
              </li>
              <li>
                <a className="p-2">Aeronave</a>
              </li>
              <li>
                <a className="p-2">Barco</a>
              </li>
              <li>
                <a className="p-2">Carro</a>
              </li>
            </ul>
          </nav>
        </div>

        <button className="flex justify-center m-7 gap-2 rounded-sm bg-background-secondary p-1 text-xs text-color-text-secondary">
          <UserCircle2 size={17} color="white" />
          Login
        </button>
      </aside>
    </>
  );
}
