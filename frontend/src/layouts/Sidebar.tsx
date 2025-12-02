import { TextAlignJustifyIcon } from "lucide-react";
import { useContext } from "react";
import { AppContext } from "../contexts/AppContext";
import Logo from "../assets/logo_brokerage.png";
import StatusIcon from "../assets/icons/fluent_data-line-16-regular.svg";
import StockageIcon from "../assets/icons/ix_product-catalog.svg";
import { useIsMobile } from "../hooks/use-is-mobile";

export default function Sidebar() {
  const { isSidebarCollapsed, setSidebarCollapsed } = useContext(AppContext);
  const isMobile = useIsMobile();
  return (
    // Sidebar com controle de caso ela esteja colapsada
    <aside
      className={`
    ${
      isMobile
        ? isSidebarCollapsed
          ? "translate-x-0 opacity-100"
          : "-translate-x-full opacity-0"
        : "translate-x-0 opacity-100"
    }
    ${isMobile ? "w-2/5 fixed h-full" : "w-64  min-h-screen"}
    top-0 left-0 transition-normal ease-out duration-300 z-50 fixed bg-black text-white
  `}
    >
      {/* Botão para esconder a sidebar */}
      {isMobile && (
        <div className="flex flex-col">
          <button
            className="p-4 self-end"
            onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
          >
            {/* Fechar a sidebar em mobiles*/}
            <TextAlignJustifyIcon size={27} />
          </button>
        </div>
      )}

      <div className="w-2/3 flex justify-center items-center mx-auto">
        <img src={Logo} className="" />
      </div>

      {/* Botões navegáveis */}
      <div className="px-6 flex flex-col gap-6 text-sm">
        <div className=" w-full">
          <a className="w-full flex gap-2 ">
            <img src={StatusIcon} />
            <p>Status</p>
          </a>
        </div>
        <div className="">
          <a className="w-full flex gap-2">
            <img src={StockageIcon} />
            <p>Estoque</p>
          </a>
        </div>
      </div>
    </aside>
  );
}
