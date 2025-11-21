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
    <article className="h-full w-full rounded-lg border border-black px-6 pt-6 pb-4 flex flex-col gap-2">
      <div className="flex justify-center">
        {imageUrl && (
          <div className="w-full max-w-md aspect-video overflow-hidden rounded-lg">
            {" "}
            <img
              src={imageUrl}
              alt={`Imagem do produto ${marca} ${modelo}`}
              className="w-full h-full object-cover"
            />{" "}
          </div>
        )}
      </div>

      <div className="flex flex-col text-base gap-2 justify-center items-center">
        <h2 className="font-semibold">
          {marca} {modelo}
        </h2>
        <p className="text-[8px] text-justify line-clamp-2">{descricao}</p>
        <p className="">{formatValue(valor)}</p>
      </div>
    </article>
  );
}
