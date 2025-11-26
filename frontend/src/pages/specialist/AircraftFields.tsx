import type { UseFormRegister, FieldErrors } from "react-hook-form";

interface AircraftFieldsProps {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
}

export default function AircraftFields({ register, errors }: AircraftFieldsProps) {
  return (
    <>
      {/* Categoria */}
      <div className="flex flex-col gap-2">
        <label htmlFor="categoria" className="text-sm font-medium text-text-primary">
          Categoria
        </label>
        <input
          id="categoria"
          type="text"
          {...register("categoria")}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ex: Executivo, Particular"
        />
        {errors.categoria && (
          <span className="text-sm text-red-500">{errors.categoria.message as string}</span>
        )}
      </div>

      {/* Assentos */}
      <div className="flex flex-col gap-2">
        <label htmlFor="assentos" className="text-sm font-medium text-text-primary">
          Assentos
        </label>
        <input
          id="assentos"
          type="number"
          {...register("assentos", {
            min: { value: 1, message: "Deve ter pelo menos 1 assento" },
          })}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ex: 8"
        />
        {errors.assentos && (
          <span className="text-sm text-red-500">{errors.assentos.message as string}</span>
        )}
      </div>

      {/* Tipo de Aeronave */}
      <div className="flex flex-col gap-2">
        <label htmlFor="tipo_aeronave" className="text-sm font-medium text-text-primary">
          Tipo de Aeronave
        </label>
        <select
          id="tipo_aeronave"
          {...register("tipo_aeronave")}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione o tipo</option>
          <option value="VLJ">VLJ (Very Light Jet)</option>
          <option value="executivo_medio">Executivo Médio</option>
          <option value="intercontinental">Intercontinental</option>
          <option value="turbohelice">Turboélice</option>
          <option value="helicoptero">Helicóptero</option>
        </select>
        {errors.tipo_aeronave && (
          <span className="text-sm text-red-500">{errors.tipo_aeronave.message as string}</span>
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
          placeholder="Descreva as características e diferenciais da aeronave..."
        />
        {errors.descricao && (
          <span className="text-sm text-red-500">{errors.descricao.message as string}</span>
        )}
      </div>
    </>
  );
}

