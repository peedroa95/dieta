import { useState } from "react";
import { CloudUpload, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { useStore } from "./store";
import { Modal } from "./ui";
import {
  localTransfer,
  transferSize,
  transferOwner,
  transferToAccount,
  validateTransfer,
  backupSource,
  type TransferResult,
} from "./transfer";
import type { Data } from "./domain";
export default function TransferData() {
  const { userId, email, run, busy } = useStore();
  const [preview, setPreview] = useState<{
    data: Data;
    sourceId: string;
    name: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TransferResult | null>(null);
  const [reading, setReading] = useState(false);
  function useLocal() {
    setError("");
    setResult(null);
    try {
      const info = localTransfer();
      if (!transferSize(info.data))
        throw new Error(
          "Não há registros locais para transferir neste navegador.",
        );
      const owner = transferOwner(info.sourceId);
      if (owner && owner !== userId)
        throw new Error(
          "Os registros deste navegador já foram transferidos para outra conta.",
        );
      setPreview({ ...info, name: "Registros deste navegador" });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function fileChange(file: File | undefined) {
    if (!file) return;
    setReading(true);
    setError("");
    setResult(null);
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Escolha um arquivo JSON de até 5 MB.");
      let raw: unknown;
      try {
        raw = JSON.parse(await file.text());
      } catch {
        throw new Error("O arquivo selecionado não é um JSON válido.");
      }
      const data = validateTransfer(raw);
      const sourceId = await backupSource(raw, data);
      const owner = transferOwner(sourceId);
      if (owner && owner !== userId)
        throw new Error("Este arquivo já foi transferido para outra conta.");
      if (!transferSize(data))
        throw new Error("O arquivo não contém registros para transferir.");
      setPreview({ data, sourceId, name: file.name });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
    }
  }
  async function confirm() {
    if (!preview) return;
    const success = await run(async () => {
      const response = await transferToAccount(
        preview.data,
        preview.sourceId,
        userId,
      );
      setResult(response);
    }, "Dados transferidos para sua conta.");
    if (success) setPreview(null);
  }
  return (
    <section className="card settings-card">
      <div className="card-title">
        <span className="card-icon sage">
          <CloudUpload size={21} />
        </span>
        <h2>Trazer meus registros</h2>
      </div>
      <p>
        Transfira os dados deste navegador ou um arquivo exportado para sua
        conta. A cópia local será preservada.
      </p>
      <div className="transfer-actions">
        <button
          className="button secondary"
          onClick={useLocal}
          disabled={busy || reading}
        >
          <CloudUpload size={16} />
          Transferir dados locais
        </button>
        <label className="button secondary upload-backup">
          <Upload size={16} />
          {reading ? "Lendo arquivo…" : "Importar arquivo JSON"}
          <input
            type="file"
            accept="application/json,.json"
            aria-label="Importar arquivo JSON"
            disabled={busy || reading}
            onChange={(e) => {
              void fileChange(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {error && (
        <p className="error" role="alert">
          <AlertCircle size={15} /> {error}
        </p>
      )}
      {result && (
        <p className="success" role="status">
          <CheckCircle2 size={16} />
          {result.already_imported
            ? "Estes dados já estavam nesta conta. Nenhum registro foi duplicado."
            : `${result.foods} alimentos e ${result.food_entries} consumos transferidos. Seus outros registros também foram processados.`}
        </p>
      )}
      {preview && (
        <Modal
          title="Transferir para esta conta?"
          subtitle={preview.name}
          onClose={() => {
            if (!busy) setPreview(null);
          }}
        >
          <div className="transfer-preview">
            <p>
              Conta de destino: <strong>{email}</strong>
            </p>
            <div className="goal-list">
              {[
                ["Alimentos", preview.data.foods.length],
                ["Consumos no diário", preview.data.food_entries.length],
                ["Registros de água", preview.data.water_logs.length],
                ["Registros de peso", preview.data.weight_logs.length],
                ["Metas", preview.data.daily_goals.length],
                ["Refeições salvas", preview.data.saved_meals.length],
              ].map(([label, count]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
            <p>
              O histórico nutricional será preservado. Cadastros, pesos e metas
              que já existem na nuvem serão mantidos. A mesma transferência não
              será aplicada duas vezes.
            </p>
            <p className="muted small">
              Confirme que estes registros são seus antes de continuar.
            </p>
            <footer className="modal-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setPreview(null)}
              >
                Cancelar
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() => void confirm()}
              >
                {busy ? "Transferindo…" : "Confirmar transferência"}
              </button>
            </footer>
          </div>
        </Modal>
      )}
    </section>
  );
}
