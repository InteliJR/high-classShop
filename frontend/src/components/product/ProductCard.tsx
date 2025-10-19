interface CardProductProps {
    image_url: string,
    brand: string,
    model: string,
    description: string,
    value: number
}

function formatValue(value : number){
    return value.toLocaleString('pt-br', {style: 'currency', currency:'BRL'})
}

export default function CardProduct( { image_url, brand, model, description, value} : CardProductProps){
    return(
        <article className="h-full w-full rounded-lg border border-black px-6 pt-6 pb-4 flex flex-col gap-2">
            <div className="flex justify-center">
                <img src={image_url} alt={`Imagem do produto ${brand} ${model}`} className="rounded-lg"/>
            </div>

            <div className="flex flex-col text-base gap-2 justify-center items-center">
                <h2 className="font-semibold">
                    {brand} {model}
                </h2>
                <p className="text-[8px] text-justify line-clamp-2">
                    {description}
                </p>
                <p className="">
                    {formatValue(value)}
                </p>
            </div>
        </article>
    );
}