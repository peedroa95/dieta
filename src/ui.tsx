import { useEffect, useRef, useId, type ReactNode } from "react";
import { X, ChevronLeft, ChevronRight, Plus, Leaf } from "lucide-react";
import { format, shiftDate, type Nutrition } from "./domain";
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current!;
    const previous = document.activeElement;
    el.showModal();
    return () => {
      el.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={wide ? "modal wide" : "modal"}
      aria-labelledby={titleId}
    >
      <header className="modal-head">
        <div>
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Fechar janela"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Empty({
  title,
  description,
  action,
  label = "Começar agora",
}: {
  title: string;
  description: string;
  action?: () => void;
  label?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Leaf size={27} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button className="button secondary" onClick={action}>
          <Plus size={16} />
          {label}
        </button>
      )}
    </div>
  );
}
export function DateControl({
  date,
  onChange,
  today,
}: {
  date: string;
  onChange: (s: string) => void;
  today: string;
}) {
  return (
    <div className="date-control">
      <button
        className="icon-button"
        aria-label="Dia anterior"
        onClick={() => onChange(shiftDate(date, -1))}
      >
        <ChevronLeft size={17} />
      </button>
      <label>
        <span>
          {date === today
            ? "Hoje"
            : new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
                weekday: "short",
              })}
          ,{" "}
        </span>
        <input
          aria-label="Dia selecionado"
          type="date"
          value={date}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
        />
      </label>
      <button
        className="icon-button"
        aria-label="Dia seguinte"
        onClick={() => onChange(shiftDate(date, 1))}
      >
        <ChevronRight size={17} />
      </button>
    </div>
  );
}
export function MacroLine({
  name,
  value,
  goal,
  color,
  unit = "g",
}: {
  name: string;
  value: number;
  goal: number;
  color: string;
  unit?: string;
}) {
  const pct = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
  return (
    <div className="macro-line">
      <div>
        <span>
          <i style={{ background: color }} />
          {name}
        </span>
        <strong>
          {format(value)}{" "}
          <small>
            / {format(goal)} {unit}
          </small>
        </strong>
      </div>
      <div
        className="track"
        role="progressbar"
        aria-label={name}
        aria-valuenow={value}
        aria-valuemax={Math.max(goal, value, 1)}
        aria-valuemin={0}
      >
        <span style={{ width: `${pct}%`, background: color }} />
      </div>
      {value > goal && (
        <small className="over-goal">
          {format(value - goal)} {unit} acima da meta
        </small>
      )}
    </div>
  );
}
export function NutrientPills({ nutrition }: { nutrition: Nutrition }) {
  return (
    <div className="nutrient-pills">
      <span>
        <b>{format(nutrition.calories)}</b> kcal
      </span>
      <span>
        <i className="dot protein" />
        {format(nutrition.protein)} g P
      </span>
      <span>
        <i className="dot carbs" />
        {format(nutrition.carbs)} g C
      </span>
      <span>
        <i className="dot fat" />
        {format(nutrition.fat)} g G
      </span>
    </div>
  );
}
export function LineChart({
  points,
  label,
  unit,
}: {
  points: { date: string; value: number }[];
  label: string;
  unit: string;
}) {
  if (!points.length)
    return (
      <div className="chart-empty">
        Seus registros aparecerão aqui.
        <br />
        <small>Comece a registrar para acompanhar sua evolução.</small>
      </div>
    );
  const max = Math.max(...points.map((p) => p.value));
  const min = Math.min(...points.map((p) => p.value));
  const range = max - min || Math.max(max * 0.1, 1);
  const coords = points.map(
    (p, i) =>
      `${25 + (points.length === 1 ? 0.5 : i / (points.length - 1)) * 650},${155 - ((p.value - min) / range) * 120}`,
  );
  return (
    <div className="line-chart">
      <svg viewBox="0 0 700 200" role="img" aria-label={label}>
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#488565" stopOpacity=".2" />
            <stop offset="1" stopColor="#488565" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[35, 95, 155].map((y) => (
          <line
            key={y}
            x1="25"
            x2="675"
            y1={y}
            y2={y}
            stroke="#e9ede8"
            strokeDasharray="4 5"
          />
        ))}
        <polygon
          points={`25,170 ${coords.join(" ")} 675,170`}
          fill="url(#chart-fill)"
        />
        <polyline
          points={coords.join(" ")}
          stroke="#3c775a"
          strokeWidth="3"
          fill="none"
          strokeLinejoin="round"
        />
        {points.map((p, i) => {
          const [cx, cy] = coords[i].split(",");
          return (
            <circle key={p.date} cx={cx} cy={cy} r="4" fill="#3c775a">
              <title>
                {p.date}: {format(p.value)} {unit}
              </title>
            </circle>
          );
        })}
        <text x="25" y="195">
          {points[0].date.split("-").reverse().slice(0, 2).join("/")}
        </text>
        <text x="675" y="195" textAnchor="end">
          {points.at(-1)!.date.split("-").reverse().slice(0, 2).join("/")}
        </text>
        <text x="25" y="17">
          {format(max)} {unit}
        </text>
      </svg>
    </div>
  );
}
