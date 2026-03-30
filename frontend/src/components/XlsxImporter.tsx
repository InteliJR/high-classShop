import { useState, useRef, useCallback } from "react";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trash2,
  Info,
  Loader2,
} from "lucide-react";

type ProductType = "CAR" | "BOAT" | "AIRCRAFT";

export interface CsvImportResponse {
  success: boolean;
  message: string;
  insertedCount: number;
  updatedCount: number;
  errorCount: number;
  warningCount: number;
  errorRows: CsvErrorRow[];
  warningRows: CsvErrorRow[];
  insertedIds?: number[];
  updatedIds?: number[];
}

export interface CsvErrorRow {
  row: number;
  reason: string;
  fields?: Record<string, any>;
  imageWarnings?: string[];
}

interface XlsxImporterProps {
  productType: ProductType;
  onImport: (file: File) => Promise<CsvImportResponse>;
  onDownloadTemplate: () => Promise<void>;
  disabled?: boolean;
  onSuccess?: () => void;
}

const PRODUCT_NAMES: Record<ProductType, string> = {
  CAR: "Carros",
  BOAT: "Lanchas",
  AIRCRAFT: "Aeronaves",
};

// Colunas por tipo (imagens por linha podem ser importadas via folder_url)
const COLUMN_DEFINITIONS: Record<
  ProductType,
  { required: string[]; optional: string[] }
> = {
  CAR: {
    required: ["marca", "modelo", "valor", "estado", "ano"],
    optional: [
      "cor",
      "km",
      "cambio",
      "combustivel",
      "tipo_categoria",
      "descricao",
      "folder_url",
    ],
  },
  BOAT: {
    required: ["marca", "modelo", "valor", "estado", "ano"],
    optional: [
      "fabricante",
      "tamanho",
      "estilo",
      "combustivel",
      "motor",
      "ano_motor",
      "tipo_embarcacao",
      "descricao_completa",
      "acessorios",
      "folder_url",
    ],
  },
  AIRCRAFT: {
    required: ["marca", "modelo", "valor", "estado", "ano"],
    optional: [
      "categoria",
      "assentos",
      "tipo_aeronave",
      "descricao",
      "folder_url",
    ],
  },
};

const MAX_FILE_SIZE_MB = 50;

export function XlsxImporter({
  productType,
  onImport,
  onDownloadTemplate,
  disabled,
  onSuccess,
}: XlsxImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [importResult, setImportResult] = useState<CsvImportResponse | null>(
    null,
  );
  const [fileError, setFileError] = useState<string | null>(null);
  const [structureError, setStructureError] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const columns = COLUMN_DEFINITIONS[productType];

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      // Reset
      setImportResult(null);
      setStructureError(null);
      setFileError(null);

      // Validar extensão
      if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
        setFileError("Apenas arquivos .csv são aceitos.");
        setFile(null);
        return;
      }

      // Validar tamanho
      const sizeMB = selectedFile.size / (1024 * 1024);
      if (sizeMB > MAX_FILE_SIZE_MB) {
        setFileError(
          `Arquivo muito grande (${sizeMB.toFixed(1)} MB). Limite: ${MAX_FILE_SIZE_MB} MB.`,
        );
        setFile(null);
        return;
      }

      setFile(selectedFile);
    },
    [],
  );

  const handleImport = async () => {
    if (!file) return;

    setIsLoading(true);
    setImportResult(null);
    setStructureError(null);

    try {
      const result = await onImport(file);
      setImportResult(result);

      if (result.errorCount === 0) {
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    } catch (error: any) {
      if (error.message || error.errors) {
        setStructureError(error);
      } else {
        setStructureError({
          message: "Erro ao processar o arquivo. Tente novamente.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setIsLoadingTemplate(true);
    try {
      await onDownloadTemplate();
    } catch (error) {
      console.error("Erro ao baixar template:", error);
      alert("Erro ao baixar o template. Tente novamente.");
    } finally {
      setIsLoadingTemplate(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setImportResult(null);
    setFileError(null);
    setStructureError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Drag and drop handlers
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const fakeEvent = {
        target: { files: [droppedFile] },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(fakeEvent);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com Download de Template */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">
              Importar {PRODUCT_NAMES[productType]}
            </h4>
            <p className="text-sm text-gray-500">
              Importe varios produtos de uma vez via CSV
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          disabled={isLoadingTemplate}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
        >
          {isLoadingTemplate ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Baixar Template
        </button>
      </div>

      {/* Instruções - Collapsible */}
      <details className="group">
        <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
          <Info className="w-4 h-4" />
          <span>Ver estrutura da planilha</span>
          <svg
            className="w-4 h-4 ml-auto transition-transform group-open:rotate-180"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </summary>

        <div className="mt-4 p-4 bg-gray-50 rounded-xl space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Colunas Obrigatorias
            </p>
            <div className="flex flex-wrap gap-2">
              {columns.required.map((col) => (
                <span
                  key={col}
                  className="inline-flex items-center px-3 py-1.5 bg-red-50 text-red-700 text-xs font-medium rounded-full border border-red-200"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Colunas Opcionais
            </p>
            <div className="flex flex-wrap gap-2">
              {columns.optional.map((col) => (
                <span
                  key={col}
                  className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full border border-gray-200"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Dicas
            </p>
            <ul className="space-y-1.5 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 mt-2 bg-gray-400 rounded-full shrink-0"></span>
                Formato aceito: <strong className="text-gray-900">.csv</strong>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 mt-2 bg-gray-400 rounded-full shrink-0"></span>
                <strong className="text-gray-900">valor</strong>: numero inteiro
                sem pontos
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 mt-2 bg-gray-400 rounded-full shrink-0"></span>
                <strong className="text-gray-900">ano</strong>: 4 digitos (ex:
                2024)
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 mt-2 bg-gray-400 rounded-full shrink-0"></span>
                <strong className="text-gray-900">folder_url</strong>: link da
                pasta pública do Google Drive com imagens do produto (opcional)
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 mt-2 bg-gray-400 rounded-full shrink-0"></span>
                Produtos com mesma{" "}
                <strong className="text-gray-900">marca + modelo</strong> serao
                atualizados ao inves de duplicados.
              </li>
            </ul>
          </div>
        </div>
      </details>

      {/* Upload Area - Drag & Drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : file
              ? "border-green-300 bg-green-50"
              : "border-gray-300 hover:border-gray-400 bg-gray-50"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileSelect}
          disabled={disabled || isLoading}
          className="hidden"
        />

        {file ? (
          <div className="space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-gray-900">{file.name}</p>
            <p className="text-xs text-gray-500">
              {(file.size / (1024 * 1024)).toFixed(2)} MB — Pronto para importar
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full">
              <Upload
                className={`w-6 h-6 ${isDragging ? "text-blue-600" : "text-gray-400"}`}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {isDragging
                  ? "Solte o arquivo aqui"
                  : "Arraste um arquivo CSV ou clique para selecionar"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Apenas arquivos .csv (max {MAX_FILE_SIZE_MB} MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Erro de arquivo */}
      {fileError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <p className="font-medium text-red-800">{fileError}</p>
          </div>
        </div>
      )}

      {/* Erro de estrutura do backend */}
      {structureError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-red-800">
                {structureError.message || "Erro na estrutura da planilha"}
              </p>
              {structureError.errors && (
                <ul className="mt-2 space-y-1">
                  {structureError.errors.map((err: string, i: number) => (
                    <li key={i} className="text-sm text-red-600">
                      {err}
                    </li>
                  ))}
                </ul>
              )}
              {structureError.missingRequired?.length > 0 && (
                <p className="text-sm text-red-600 mt-2">
                  Colunas faltando:{" "}
                  <span className="font-medium">
                    {structureError.missingRequired.join(", ")}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Botões de ação */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleImport}
          disabled={!file || isLoading || disabled}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:ring-4 focus:ring-green-200 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Importar CSV
            </>
          )}
        </button>

        {(file || importResult) && (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Limpar
          </button>
        )}
      </div>

      {/* Resultado da importação */}
      {importResult && (
        <div
          className={`p-5 rounded-xl border-2 ${
            importResult.success
              ? "bg-green-50 border-green-300"
              : "bg-amber-50 border-amber-300"
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`p-2 rounded-full ${importResult.success ? "bg-green-100" : "bg-amber-100"}`}
            >
              {importResult.success ? (
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              )}
            </div>
            <div className="flex-1">
              <h4
                className={`text-lg font-semibold ${importResult.success ? "text-green-800" : "text-amber-800"}`}
              >
                Importacao Concluida
              </h4>
              <p className="text-gray-600 mt-1">{importResult.message}</p>

              {/* Stats */}
              <div className="flex gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">
                    <span className="font-semibold text-green-700">
                      {importResult.insertedCount}
                    </span>{" "}
                    inseridos
                  </span>
                </div>
                {importResult.updatedCount > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm text-gray-700">
                      <span className="font-semibold text-blue-700">
                        {importResult.updatedCount}
                      </span>{" "}
                      atualizados
                    </span>
                  </div>
                )}
                {importResult.warningCount > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm text-gray-700">
                      <span className="font-semibold text-yellow-700">
                        {importResult.warningCount}
                      </span>{" "}
                      com avisos
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">
                    <span className="font-semibold text-red-700">
                      {importResult.errorCount}
                    </span>{" "}
                    erros
                  </span>
                </div>
              </div>

              {/* Lista de erros por linha */}
              {importResult.errorRows.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-red-700 mb-2">
                    Detalhes dos erros ({importResult.errorRows.length})
                  </p>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-red-200">
                    <table className="w-full text-sm">
                      <thead className="bg-red-100 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-red-800 font-medium w-20">
                            Linha
                          </th>
                          <th className="px-3 py-2 text-left text-red-800 font-medium">
                            Motivo
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {importResult.errorRows.map(
                          (errorRow: CsvErrorRow, index: number) => (
                            <tr
                              key={index}
                              className="border-t border-red-100 hover:bg-red-50"
                            >
                              <td className="px-3 py-2 font-mono text-red-600 font-medium">
                                {errorRow.row}
                              </td>
                              <td className="px-3 py-2 text-red-600">
                                {errorRow.reason}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Lista de avisos de imagem por linha */}
              {importResult.warningRows &&
                importResult.warningRows.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-yellow-700 mb-2">
                      Avisos de imagem ({importResult.warningRows.length})
                    </p>
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-yellow-200">
                      <table className="w-full text-sm">
                        <thead className="bg-yellow-100 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-yellow-800 font-medium w-20">
                              Linha
                            </th>
                            <th className="px-3 py-2 text-left text-yellow-800 font-medium">
                              Detalhes
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {importResult.warningRows.map(
                            (warnRow: CsvErrorRow, index: number) => (
                              <tr
                                key={index}
                                className="border-t border-yellow-100 hover:bg-yellow-50"
                              >
                                <td className="px-3 py-2 font-mono text-yellow-700 font-medium">
                                  {warnRow.row}
                                </td>
                                <td className="px-3 py-2 text-yellow-700">
                                  <p>{warnRow.reason}</p>
                                  {warnRow.imageWarnings &&
                                    warnRow.imageWarnings.length > 0 && (
                                      <ul className="mt-1 space-y-0.5">
                                        {warnRow.imageWarnings.map((w, i) => (
                                          <li
                                            key={i}
                                            className="text-xs text-yellow-600 flex items-start gap-1"
                                          >
                                            <span className="w-1 h-1 mt-1.5 bg-yellow-400 rounded-full shrink-0"></span>
                                            {w}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {/* Botão de concluir quando importação foi bem-sucedida */}
              {importResult.errorCount === 0 && onSuccess && (
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      resetAll();
                      onSuccess();
                    }}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-all shadow-md"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Concluir
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default XlsxImporter;
