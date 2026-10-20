import { useEffect, useRef, useState } from "react";
import { Barcode, Search, LoaderCircle, ArrowUpRight } from "lucide-react";
import { barcodeValue, lookupBarcode, type ProductLookup } from "./barcodes";
import { labels, nutrients, format, type Food } from "./domain";
export default function BarcodeLookup({
  value,
  onChange,
  onApply,
  foods,
  foodId,
  autoFocus = false,
}: {
  value: string;
  onChange: (s: string) => void;
  onApply: (result: ProductLookup, unit: "g" | "ml") => void;
  foods: Food[];
  foodId: string;
  autoFocus?: boolean;
}) {
  const [result, setResult] = useState<ProductLookup | null>(null);
  const [unit, setUnit] = useState<"" | "g" | "ml">("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      const previous = request.current;
      request.current = null;
      previous?.abort();
    },
    [],
  );
  const cancel = () => {
    request.current?.abort();
    request.current = null;
    setLoading(false);
    setResult(null);
    setError("");
    setUnit("");
  };
  async function search() {
    cancel();
    let code: string;
    try {
      code = barcodeValue(value);
      const existing = foods.find(
        (f) =>
          f.id !== foodId &&
          f.barcode &&
          f.barcode.padStart(14, "0") === code.padStart(14, "0"),
      );
      if (existing)
        throw new Error(
          `Este código já está cadastrado em “${existing.name}”. Abra o cadastro para editar.`,
        );
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    const timeout = setTimeout(() => controller.abort("timeout"), 12000);
    try {
      const product = await lookupBarcode(code, controller.signal);
      if (request.current === controller) {
        setResult(product);
        onChange(code);
      }
    } catch (e) {
      if (request.current === controller) {
        if (controller.signal.aborted)
          setError(
            "A consulta demorou demais. Tente novamente ou preencha os dados manualmente.",
          );
        else setError((e as Error).message);
      }
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) {
        setLoading(false);
        request.current = null;
      }
    }
  }
  return (
    <section
      className="barcode-section"
      aria-label="Cadastro por código de barras"
    >
      <div className="barcode-heading">
        <Barcode size={20} />
        <div>
          <strong>Cadastre pelo código de barras</strong>
          <p>Digite o EAN da embalagem e consulte os dados do produto.</p>
        </div>
      </div>
      <label htmlFor="food-barcode">
        EAN / código de barras <small>opcional</small>
      </label>
      <div className="barcode-input">
        <input
          id="food-barcode"
          autoFocus={autoFocus}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={24}
          value={value}
          placeholder="Ex.: 789…"
          onChange={(e) => {
            cancel();
            onChange(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
        />
        <button
          type="button"
          className="button secondary"
          disabled={!value.trim() || loading}
          onClick={() => void search()}
        >
          {loading ? (
            <LoaderCircle className="spinner" size={16} />
          ) : (
            <Search size={16} />
          )}{" "}
          {loading ? "Buscando…" : "Buscar produto"}
        </button>
      </div>
      {error && (
        <p className="barcode-message error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className="barcode-result">
          <strong>{result.name || "Produto sem nome na fonte"}</strong>
          <span>{result.brand || "Marca não informada"}</span>
          <div className="barcode-nutrients">
            {nutrients.slice(0, 4).map((n) => (
              <span key={n}>
                {labels[n]}
                <b>
                  {result.nutrition[n] === undefined
                    ? "Não informado"
                    : `${format(result.nutrition[n]!)} ${n === "calories" ? "kcal" : "g"}`}
                </b>
              </span>
            ))}
          </div>
          <label htmlFor="import-unit">
            Confirme a referência no rótulo
            <select
              id="import-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as "" | "g" | "ml")}
            >
              <option value="">Selecione a unidade…</option>
              <option value="g">Valores por 100 g</option>
              <option value="ml">Valores por 100 ml</option>
            </select>
          </label>
          <p>
            A fonte fornece valores por 100 g/100 ml. Confira a unidade e os
            nutrientes na embalagem; produtos podem mudar de fórmula.
          </p>
          {result.missing.length > 0 && (
            <p>
              Não informados:{" "}
              {result.missing.map((n) => labels[n].toLowerCase()).join(", ")}.
              Complete pelo rótulo, se necessário.
            </p>
          )}
          <div className="barcode-result-actions">
            <a href={result.source_url} target="_blank" rel="noreferrer">
              Open Food Facts · ODbL <ArrowUpRight size={12} />
            </a>
            <button
              type="button"
              className="button"
              disabled={!unit}
              onClick={() => {
                if (unit) onApply(result, unit);
                setResult(null);
              }}
            >
              Usar dados no cadastro
            </button>
          </div>
        </div>
      )}
      <small className="barcode-helper">
        Sem resultado? Mantenha o código e preencha os campos abaixo para salvar
        manualmente.
      </small>
    </section>
  );
}
