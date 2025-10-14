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

export default function CardProduto( { image_url, marca, modelo, descricao, valor} : CardProdutoProps){
    return(
        <article className="h-full w-full rounded-lg border border-black px-6 pt-6 pb-4 flex flex-col gap-2">
            <div className="flex justify-center">
                <img src={image_url} alt={`Imagem do produto ${marca} ${modelo}`} className="rounded-lg"/>
            </div>

            <div className="flex flex-col text-base gap-2 justify-center items-center">
                <h2 className="font-semibold">
                    {marca} {modelo}
                </h2>
                <p className="text-[8px] text-justify line-clamp-2">
                    {descricao}
                </p>
                <p className="">
                    {formatValue(valor)}
                </p>
            </div>
        </article>
    );
}