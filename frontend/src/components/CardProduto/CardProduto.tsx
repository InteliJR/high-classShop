interface CardProdutoProps {
    image_url: string,
    marca: string,
    modelo: string,
    descricao: string,
    valor: number
}

function formatValue(valor : number){
    return valor.toLocaleString('pt-br', {style: 'currency', currency:'BRL'})
}

export const CardProduto = ( { image_url, marca, modelo, descricao, valor} : CardProdutoProps) => {
    return(
        <article className="h-full w-full rounded-2xl border border-black p-3 flex flex-col gap-2">
            <div className="flex justify-center">
                <img src={image_url} alt={`Imagem do produto ${marca} ${modelo}`} className="rounded-2xl"/>
            </div>

            <div className="flex flex-col text-base gap-2">
                <h2 className="font-semibold">
                    {marca} {modelo}
                </h2>
                <p className="text-[8px] text-balance line-clamp-2">
                    {descricao}
                </p>
                <p className="">
                    {formatValue(valor)}
                </p>
            </div>
        </article>
    );
}