import { TextAlignJustifyIcon, UserCircle2 } from "lucide-react";
import Logo from "../assets/logo_brokerage.png";
import { useState } from "react";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="w-full flex h-24 bg-background-secondary text-white justify-end items-center px-6">
        {/* Logo */}
        <div className="flex w-full justify-between items-center">
          <TextAlignJustifyIcon
            size={35}
            onClick={() => {
              setOpen(!open);
            }}
          />
          <img src={Logo} className="w-20 h-20" />
        </div>

        {/* Navegáveis */}
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
            <TextAlignJustifyIcon size={27} />
          </button>
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
