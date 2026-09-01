import TipoComSugestoes from "./TipoComSugestoes";
import type { UseFormRegister, FieldErrors } from "react-hook-form";

interface AircraftFieldsProps {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
}

export default function AircraftFields({ register, errors }: AircraftFieldsProps) {
  return (
    <>
      <TipoComSugestoes
        id="categoria"
        label="Categoria"
        opcoes={[
          { value: "Executivo", label: "Executivo" },
          { value: "Particular", label: "Particular" },
          { value: "Comercial", label: "Comercial" },
          { value: "Utilitário", label: "Utilitário" },
        ]}
        registro={register("categoria")}
        erro={errors.categoria?.message as string | undefined}
      />

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
          placeholder="Ex: 8 passageiros"
        />
        {errors.assentos && (
          <span className="text-sm text-red-500">{errors.assentos.message as string}</span>
        )}
      </div>

      <TipoComSugestoes
        id="tipo_aeronave"
        label="Tipo de Aeronave"
        opcoes={[
          { value: "VLJ", label: "VLJ (Very Light Jet)" },
          { value: "executivo_medio", label: "Executivo Médio" },
          { value: "intercontinental", label: "Intercontinental" },
          { value: "turbohelice", label: "Turboélice" },
          { value: "helicoptero", label: "Helicóptero" },
        ]}
        registro={register("tipo_aeronave")}
        erro={errors.tipo_aeronave?.message as string | undefined}
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
          placeholder="Ex: Jato executivo com autonomia de 3.650 km, velocidade de cruzeiro de 839 km/h. Cabine pressurizada com 8 assentos em couro, sistema de entretenimento completo, banheiro privativo, galley equipada..."
        />
        {errors.descricao && (
          <span className="text-sm text-red-500">{errors.descricao.message as string}</span>
        )}
      </div>
    </>
  );
}

