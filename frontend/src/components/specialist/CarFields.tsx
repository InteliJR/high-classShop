import TipoComSugestoes from "./TipoComSugestoes";
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
        <select
          id="cor"
          {...register("cor")}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione a cor</option>
          <option value="Preto">Preto</option>
          <option value="Branco">Branco</option>
          <option value="Prata">Prata</option>
          <option value="Cinza">Cinza</option>
          <option value="Vermelho">Vermelho</option>
          <option value="Azul">Azul</option>
          <option value="Amarelo">Amarelo</option>
          <option value="Verde">Verde</option>
          <option value="Laranja">Laranja</option>
          <option value="Dourado">Dourado</option>
          <option value="Outro">Outro</option>
        </select>
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
          placeholder="Ex: 5000 (digite 0 para veículos novos)"
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

      <TipoComSugestoes
        id="tipo_categoria"
        label="Tipo/Categoria"
        opcoes={[
          { value: "SUV", label: "SUV" },
          { value: "sedan", label: "Sedan" },
          { value: "coupe", label: "Coupé" },
          { value: "conversivel", label: "Conversível" },
          { value: "esportivo", label: "Esportivo" },
          { value: "supercarro", label: "Supercarro" },
        ]}
        registro={register("tipo_categoria")}
        erro={errors.tipo_categoria?.message as string | undefined}
      />

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
          placeholder="Ex: Motor V8 biturbo de 720cv, 0-100 em 2.9s. Interior em couro Nappa, sistema de som premium, teto solar panorâmico, rodas de liga leve 21 polegadas..."
        />
        {errors.descricao && (
          <span className="text-sm text-red-500">{errors.descricao.message as string}</span>
        )}
      </div>
    </>
  );
}

