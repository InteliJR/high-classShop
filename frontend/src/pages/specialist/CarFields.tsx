import type { UseFormRegister, FieldErrors } from "react-hook-form";

interface CarFieldsProps {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
}

export default function CarFields({ register, errors }: CarFieldsProps) {
  return (
    <>
      {/* Cor */}
      <div className="flex flex-col gap-2">
        <label htmlFor="cor" className="text-sm font-medium text-text-primary">
          Cor
        </label>
        <input
          id="cor"
          type="text"
          {...register("cor")}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ex: Vermelho, Preto, Branco"
        />
        {errors.cor && (
          <span className="text-sm text-red-500">{errors.cor.message as string}</span>
        )}
      </div>

      {/* Quilometragem */}
      <div className="flex flex-col gap-2">
        <label htmlFor="km" className="text-sm font-medium text-text-primary">
          Quilometragem (km)
        </label>
        <input
          id="km"
          type="number"
          {...register("km", {
            min: { value: 0, message: "Quilometragem não pode ser negativa" },
          })}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ex: 15000"
        />
        {errors.km && (
          <span className="text-sm text-red-500">{errors.km.message as string}</span>
        )}
      </div>

      {/* Câmbio */}
      <div className="flex flex-col gap-2">
        <label htmlFor="cambio" className="text-sm font-medium text-text-primary">
          Câmbio
        </label>
        <select
          id="cambio"
          {...register("cambio")}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione o câmbio</option>
          <option value="manual">Manual</option>
          <option value="automatico">Automático</option>
          <option value="cvt">CVT</option>
        </select>
        {errors.cambio && (
          <span className="text-sm text-red-500">{errors.cambio.message as string}</span>
        )}
      </div>

      {/* Combustível */}
      <div className="flex flex-col gap-2">
        <label htmlFor="combustivel" className="text-sm font-medium text-text-primary">
          Combustível
        </label>
        <select
          id="combustivel"
          {...register("combustivel")}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione o combustível</option>
          <option value="gasolina">Gasolina</option>
          <option value="alcool">Álcool</option>
          <option value="flex">Flex</option>
          <option value="diesel">Diesel</option>
          <option value="eletrico">Elétrico</option>
          <option value="hibrido">Híbrido</option>
        </select>
        {errors.combustivel && (
          <span className="text-sm text-red-500">{errors.combustivel.message as string}</span>
        )}
      </div>

      {/* Tipo/Categoria */}
      <div className="flex flex-col gap-2">
        <label htmlFor="tipo_categoria" className="text-sm font-medium text-text-primary">
          Tipo/Categoria
        </label>
        <select
          id="tipo_categoria"
          {...register("tipo_categoria")}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione a categoria</option>
          <option value="SUV">SUV</option>
          <option value="sedan">Sedan</option>
          <option value="coupe">Coupé</option>
          <option value="conversivel">Conversível</option>
          <option value="esportivo">Esportivo</option>
          <option value="supercarro">Supercarro</option>
        </select>
        {errors.tipo_categoria && (
          <span className="text-sm text-red-500">{errors.tipo_categoria.message as string}</span>
        )}
      </div>

      {/* Descrição */}
      <div className="flex flex-col gap-2 col-span-2">
        <label htmlFor="descricao" className="text-sm font-medium text-text-primary">
          Descrição
        </label>
        <textarea
          id="descricao"
          {...register("descricao")}
          rows={4}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Descreva as características e diferenciais do veículo..."
        />
        {errors.descricao && (
          <span className="text-sm text-red-500">{errors.descricao.message as string}</span>
        )}
      </div>
    </>
  );
}

