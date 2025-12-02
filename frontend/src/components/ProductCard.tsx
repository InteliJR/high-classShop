import type { Product } from "../types/types";

function formatValue(valor: number) {
  return valor.toLocaleString("pt-br", { style: "currency", currency: "BRL" });
}

export default function ProductCard({
  imageUrl,
  marca,
  modelo,
  descricao,
  valor,
}: Product) {
  return (
    <article className="h-full w-full rounded-lg border border-black px-3 sm:px-6 pt-3 sm:pt-6 pb-4 flex flex-col gap-2">
      <div className="flex justify-center">
        {imageUrl && (
          <div className="w-full max-w-md aspect-square sm:aspect-video overflow-hidden rounded-lg">
            {" "}
            <img
              src={imageUrl}
              alt={`Imagem do produto ${marca} ${modelo}`}
              className="w-full h-full object-cover"
            />{" "}
          </div>
        )}
      </div>

      <div className="flex flex-col text-sm sm:text-xl gap-2 justify-between items-center h-full">
        <div className="flex flex-col h-full justify-center align-center">
        <h2 className="font-semibold">
          {marca} {modelo}
        </h2>
        </div>
        <div className="flex flex-col gap-y-1">
        <p className="text-[8px] sm:text-xs  text-justify line-clamp-2">{descricao}</p>
        <p className="">{formatValue(valor)}</p>
        </div>
      </div>
    </article>
  );
}
