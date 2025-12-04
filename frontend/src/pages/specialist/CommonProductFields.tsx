import type { UseFormRegister, FieldErrors } from "react-hook-form";

interface CommonProductFieldsProps {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  productType?: "CAR" | "BOAT" | "AIRCRAFT";
}

export default function CommonProductFields({ register, errors, productType }: CommonProductFieldsProps) {
  // Placeholders específicos por tipo de produto
  const placeholders = {
    marca: {
      CAR: "Ex: Ferrari, Porsche, Lamborghini",
      BOAT: "Ex: Azimut, Ferretti, Sunseeker",
      AIRCRAFT: "Ex: Embraer, Gulfstream, Cessna",
    },
    modelo: {
      CAR: "Ex: 488 GTB, 911 Turbo S, Aventador",
      BOAT: "Ex: S6, Flybridge 68, Manhattan 55",
      AIRCRAFT: "Ex: Phenom 300, G650, Citation X",
    },
    ano: {
      CAR: "Ex: 2024",
      BOAT: "Ex: 2023",
      AIRCRAFT: "Ex: 2022",
    },
    valor: {
      CAR: "Ex: 2500000",
      BOAT: "Ex: 5000000",
      AIRCRAFT: "Ex: 15000000",
    },
  };
  return (
    <>
      {/* Marca */}
      <div className="flex flex-col gap-2">
        <label htmlFor="marca" className="text-sm font-medium text-text-primary">
          Marca *
        </label>
        <input
          id="marca"
          type="text"
          {...register("marca", { required: "Marca é obrigatória" })}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={productType ? placeholders.marca[productType] : "Ex: Ferrari, Azimut, Embraer"}
        />
        {errors.marca && (
          <span className="text-sm text-red-500">{errors.marca.message as string}</span>
        )}
      </div>

      {/* Modelo */}
      <div className="flex flex-col gap-2">
        <label htmlFor="modelo" className="text-sm font-medium text-text-primary">
          Modelo *
        </label>
        <input
          id="modelo"
          type="text"
          {...register("modelo", { required: "Modelo é obrigatório" })}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={productType ? placeholders.modelo[productType] : "Ex: 488 GTB, S6, Phenom 300"}
        />
        {errors.modelo && (
          <span className="text-sm text-red-500">{errors.modelo.message as string}</span>
        )}
      </div>

      {/* Ano */}
      <div className="flex flex-col gap-2">
        <label htmlFor="ano" className="text-sm font-medium text-text-primary">
          Ano *
        </label>
        <input
          id="ano"
          type="number"
          {...register("ano", {
            required: "Ano é obrigatório",
            min: { value: 1900, message: "Ano deve ser maior que 1900" },
            max: { value: new Date().getFullYear() + 1, message: "Ano inválido" },
          })}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={productType ? placeholders.ano[productType] : "Ex: 2024"}
        />
        {errors.ano && (
          <span className="text-sm text-red-500">{errors.ano.message as string}</span>
        )}
      </div>

      {/* Valor */}
      <div className="flex flex-col gap-2">
        <label htmlFor="valor" className="text-sm font-medium text-text-primary">
          Valor (R$) *
        </label>
        <input
          id="valor"
          type="number"
          step="0.01"
          {...register("valor", {
            required: "Valor é obrigatório",
            min: { value: 0.01, message: "Valor deve ser maior que 0" },
          })}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={productType ? placeholders.valor[productType] : "Ex: 1500000"}
        />
        {errors.valor && (
          <span className="text-sm text-red-500">{errors.valor.message as string}</span>
        )}
      </div>

      {/* Estado */}
      <div className="flex flex-col gap-2">
        <label htmlFor="estado" className="text-sm font-medium text-text-primary">
          Estado *
        </label>
        <select
          id="estado"
          {...register("estado", { required: "Estado é obrigatório" })}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione o estado</option>
          <option value="novo">Novo</option>
          <option value="seminovo">Seminovo</option>
          <option value="colecao">Coleção</option>
        </select>
        {errors.estado && (
          <span className="text-sm text-red-500">{errors.estado.message as string}</span>
        )}
      </div>
    </>
  );
}

