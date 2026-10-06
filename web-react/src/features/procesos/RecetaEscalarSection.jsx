import { useState } from 'react';
import Select from '../../components/ui/Select';
import ThousandsField from '../../components/ui/ThousandsField';
import Button from '../../components/ui/Button';
import { parseThousandsInput } from '../../utils/format';
import { esUnidadDePeso, fmtPesoGramos } from '../../services/recetasApi';
import './RecetaEscalarSection.css';

function redondear(n) {
  return Math.round(n * 100) / 100;
}

// Al final de Etapas, antes de "Empezar producción" — a pedido explícito
// del usuario: elegir UN ingrediente de la receta + la cantidad que se va
// a comprar de ese ingrediente, y escalar TODOS los ingredientes de
// peso/volumen por el mismo factor para que la receta rinda esa cantidad
// manteniendo exactamente los mismos porcentajes entre ingredientes. Los
// ingredientes "por unidad" (conteo, sin %, ver esUnidadDePeso) no tienen
// gramos que escalar y quedan sin tocar.
export default function RecetaEscalarSection({ maestros, pesoTotalActual, onEscalar }) {
  const porPeso = maestros.filter(m => esUnidadDePeso(m.unidad));
  const [nombreSel, setNombreSel] = useState('');
  const [cantidadDraft, setCantidadDraft] = useState('');
  const [busy, setBusy] = useState(false);

  if (!porPeso.length) return null;

  const ingSel = porPeso.find(m => m.nombre === nombreSel);
  const nuevaCantidad = parseThousandsInput(cantidadDraft) || 0;
  const factor = ingSel && ingSel.cantidadComprada > 0 && nuevaCantidad > 0
    ? nuevaCantidad / ingSel.cantidadComprada
    : null;
  const nuevoPesoTotal = factor != null ? pesoTotalActual * factor : null;
  // Mismo criterio que el resto de la app para convertir peso a volumen
  // (1 ml ≈ 1 g, ver UNIDAD_A_GRAMOS en recetasApi.js) — cuántos frascos
  // enteros rinde ese peso, a pedido explícito del usuario.
  const frascos230 = nuevoPesoTotal != null ? Math.floor(nuevoPesoTotal / 230) : null;
  const frascos130 = nuevoPesoTotal != null ? Math.floor(nuevoPesoTotal / 130) : null;

  async function handleActualizar() {
    if (!factor) return;
    setBusy(true);
    try {
      const nuevosMaestros = maestros.map(m => esUnidadDePeso(m.unidad)
        ? { ...m, cantidadComprada: redondear(m.cantidadComprada * factor), cantidadReceta: redondear(m.cantidadReceta * factor) }
        : m);
      await onEscalar(nuevosMaestros);
      setNombreSel('');
      setCantidadDraft('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="receta-detail-section receta-escalar-section">
      <h4 className="receta-detail-section-title">Escalar receta</h4>
      <Select
        label="Ingrediente"
        value={nombreSel}
        onChange={e => { setNombreSel(e.target.value); setCantidadDraft(''); }}
        options={[{ value: '', label: 'Elegir…' }, ...porPeso.map(m => ({ value: m.nombre, label: m.nombre }))]}
      />
      {!!ingSel && (
        <ThousandsField
          label={`Cantidad para comprar${ingSel.unidad ? ` (${ingSel.unidad})` : ''}`}
          placeholder="0"
          value={cantidadDraft}
          onChange={setCantidadDraft}
          disabled={busy}
        />
      )}
      {nuevoPesoTotal != null && (
        <div className="receta-escalar-resultado">
          <p>
            Peso total de la receta con ese cálculo: <strong>{fmtPesoGramos(nuevoPesoTotal)}</strong>
            <span className="receta-escalar-frascos"> · ≈{frascos230} frascos de 230 ml o {frascos130} de 130 ml</span>
          </p>
          <Button type="button" variant="primary" disabled={busy} onClick={handleActualizar}>
            {busy ? 'Actualizando…' : 'Actualizar receta y cambiar todos los gramos de cada producto manteniendo los porcentajes'}
          </Button>
        </div>
      )}
    </div>
  );
}
