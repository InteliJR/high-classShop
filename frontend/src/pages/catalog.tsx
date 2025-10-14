import CardProduto from "../components/CardProduto.tsx";

 const mockCards = Array.from({length : 5}, (_, __) => ({
    image_url: "https://picsum.photos/id/183/300/200",
    marca: "Ford",
    modelo: "Uno",
    descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur rhoncus neque risus, non interdum ligula ullamcorper condimentum. Quisque mauris elit, malesuada quis fermentum eget, sollicitudin interdum massa. Ut consectetur egestas quam, id ultrices magna sollicitudin id. Duis venenatis, orci a suscipit volutpat, nisi purus porttitor nisl, sed egestas mi nibh bibendum justo. Morbi et metus congue, euismod elit sit amet, aliquet neque. Nulla ipsum nisl, lobortis id felis molestie, vestibulum tempus ipsum. Morbi tempor tempor magna id hendrerit.",
    valor: 25000.00
  }));

  const title = "Carros"

export default function Catalog(){
    return(
        <div className="flex flex-col gap-8 mx-auto">
            <div className="flex justify-between">
                <h1 className="text-4xl">
                    {title}
                </h1>
                <button className="bg-secondary text-white rounded-sm px-4 py-1 flex justify-center items-center text-base">
                    Filtro
                </button>
            </div>

            {mockCards.length >= 4 && 
                (
                <div className="grid grid-cols-4 gap-x-4 gap-y-10"> 
                {
                    mockCards.map( (element, index) => (
                        <CardProduto key={index} {...element} />
                ))}
                </div>
            )
            } 

        </div>
    );
}