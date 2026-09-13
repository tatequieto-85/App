import { useState } from 'react';
import Widget from '../../components/ui/Widget';
import { useVentas } from './useVentas';
import { feriaEstaEnCurso, feriaEsFutura, feriaHaTerminado } from '../../services/feriasApi';
import { fmtDayMonthSlash } from '../../utils/format';
import FeriaCounterModal from './FeriaCounterModal';
import FeriaStockModal from './FeriaStockModal';
import FeriaResumenModal from './FeriaResumenModal';

function pickView(feria) {
  if (feriaEstaEnCurso(feria)) return 'counter';
  if (feriaEsFutura(feria)) return 'stock';
  return 'resumen';
}

// Widget de acceso directo (angosto): la feria más próxima entre todas las
// no terminadas (en curso, o la que arranca antes — mismo criterio que la
// lista "activas" de VentasPage). Un toque abre directo la vista que le
// corresponda según su estado (contador/plan de stock/resumen), sin pasar
// por la galería de canales.
export default function VentasWidget({ removing, onRequestRemove, onConfirmRemove }) {
  const vt = useVentas();
  const [openView, setOpenView] = useState(null); // 'counter' | 'stock' | 'resumen' | null

  const proxima = vt.ferias
    .filter(f => !feriaHaTerminado(f))
    .slice()
    .sort((a, b) => (a.fechaInicio || '9999').localeCompare(b.fechaInicio || '9999'))[0] || null;

  const canal = proxima ? vt.canales.find(c => c.id === proxima.canalId) : null;

  return (
    <>
      <Widget
        icon="flag" title="Ventas"
        onTap={() => proxima && setOpenView(pickView(proxima))}
        removing={removing} onRequestRemove={onRequestRemove} onConfirmRemove={onConfirmRemove}
      >
        {vt.loading ? (
          <p className="widget-line widget-line--sub">Cargando…</p>
        ) : proxima ? (
          <>
            <div className="widget-line" style={{ fontWeight: 700 }}>{proxima.empresa}</div>
            <div className="widget-line widget-line--sub">
              {canal ? `${canal.nombre} · ` : ''}{fmtDayMonthSlash(proxima.fechaInicio)}–{fmtDayMonthSlash(proxima.fechaFin)}
            </div>
          </>
        ) : (
          <p className="widget-line widget-line--sub">Sin ferias próximas</p>
        )}
      </Widget>

      {proxima && (
        <>
          <FeriaCounterModal
            open={openView === 'counter'}
            onClose={() => setOpenView(null)}
            feria={proxima}
            ejecuciones={vt.ejecuciones}
            onRegistrarSalida={vt.registrarSalida}
            onAddObservacionDiaria={vt.addObservacionDiaria}
            onTerminar={async feriaId => { await vt.terminarFeria(feriaId); setOpenView('resumen'); }}
            onCommitSession={vt.commitConteoSession}
          />
          <FeriaStockModal
            open={openView === 'stock'}
            onClose={() => setOpenView(null)}
            feria={proxima}
            ejecuciones={vt.ejecuciones}
            ctx={vt.ctx}
            onSave={vt.saveStockPlan}
          />
          <FeriaResumenModal
            open={openView === 'resumen'}
            onClose={() => setOpenView(null)}
            feria={proxima}
            ejecuciones={vt.ejecuciones}
          />
        </>
      )}
    </>
  );
}
