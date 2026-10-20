import { useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Icon from '../../components/icons/Icon';
import Select from '../../components/ui/Select';
import TextField from '../../components/ui/TextField';
import { useCalculadora } from './useCalculadora';
import { computeCostoRecetaEscalado } from '../../services/recetasApi';
import { normalizeIngName } from '../../services/ingredientesApi';
import { fmtCOP } from '../../utils/format';
import './CalculadoraPage.css';

let nextRowId = 1;
function nuevaFila() {
  return { id: nextRowId++, recetaId: '', cantidad: '' };
}

// "Necesito hacer 5 de este sabor, 29 de este sabor" — a pedido explícito
// del usuario: elegís varias recetas con cuántas UNIDADES finales querés
// sacar de cada una, y acá se calcula cuánto cuesta en insumos, según los
// últimos precios de Compras (mismo criterio que el costo estimado de una
// receta en Procesos). Cada receta escala según su `unidadesPorLote` (lo
// que rinde un lote completo tal como está cargada — ver RecetaModal.jsx);
// una receta sin eso configurado no se puede escalar, queda afuera de la
// cuenta con un aviso. No guarda nada — es una calculadora de verdad.
export default function CalculadoraPage() {
  const { recetas, compras, loading, error } = useCalculadora();
  const [filas, setFilas] = useState([nuevaFila()]);

  function addFila() {
    setFilas(fs => [...fs, nuevaFila()]);
  }
  function removeFila(id) {
    setFilas(fs => fs.filter(f => f.id !== id));
  }
  function updateFila(id, campo, valor) {
    setFilas(fs => fs.map(f => f.id === id ? { ...f, [campo]: valor } : f));
  }

  const resultados = useMemo(() => {
    const porInsumo = new Map(); // normalizado -> { nombre, unidad, cantidad, costo }
    const incompletos = new Set();
    const sinConfigurar = [];
    let totalGeneral = 0;
    const porFila = {};

    filas.forEach(f => {
      const receta = recetas.find(r => r.id === f.recetaId);
      const cantidadNum = parseInt(f.cantidad, 10) || 0;
      if (!receta || !cantidadNum) return;
      if (!receta.unidadesPorLote) {
        if (!sinConfigurar.includes(receta.nombre)) sinConfigurar.push(receta.nombre);
        return;
      }
      const factor = cantidadNum / receta.unidadesPorLote;
      const { total, incompleto, detalle } = computeCostoRecetaEscalado(compras, receta.ingredientesMaestros, factor);
      porFila[f.id] = total;
      totalGeneral += total;
      incompleto.forEach(n => incompletos.add(n));
      detalle.forEach(d => {
        const key = normalizeIngName(d.nombre);
        const prev = porInsumo.get(key);
        if (prev) {
          prev.cantidad += d.cantidad;
          prev.costo += d.costo;
        } else {
          porInsumo.set(key, { nombre: d.nombre, unidad: d.unidad, cantidad: d.cantidad, costo: d.costo });
        }
      });
    });

    return {
      filasInsumos: [...porInsumo.values()].sort((a, b) => b.costo - a.costo),
      incompletos: [...incompletos],
      sinConfigurar,
      totalGeneral,
      porFila
    };
  }, [filas, recetas, compras]);

  const recetaOpciones = recetas.map(r => ({
    value: r.id,
    label: r.unidadesPorLote ? `${r.nombre} (${r.unidadesPorLote}/lote)` : `${r.nombre} (sin configurar)`
  }));

  return (
    <div>
      {loading && <div className="loading-state">Cargando…</div>}
      {error && <EmptyState>No se pudo cargar: {error}</EmptyState>}

      {!loading && !error && (
        <>
          {!recetas.length ? (
            <EmptyState>Todavía no hay recetas cargadas en Procesos.</EmptyState>
          ) : (
            <div className="calculadora-filas">
              {filas.map(f => (
                <div key={f.id} className="calculadora-fila">
                  <div className="field-row calculadora-fila-campos">
                    <Select
                      label="Sabor" value={f.recetaId}
                      onChange={e => updateFila(f.id, 'recetaId', e.target.value)}
                      options={[{ value: '', label: 'Elegí una receta' }, ...recetaOpciones]}
                    />
                    <TextField
                      label="Unidades" type="number" min="0" step="1" placeholder="0"
                      value={f.cantidad} onChange={e => updateFila(f.id, 'cantidad', e.target.value)}
                    />
                  </div>
                  <div className="calculadora-fila-footer">
                    {resultados.porFila[f.id] != null && (
                      <span className="calculadora-fila-subtotal">{fmtCOP(resultados.porFila[f.id])}</span>
                    )}
                    {filas.length > 1 && (
                      <button type="button" className="calculadora-fila-quitar" onClick={() => removeFila(f.id)} aria-label="Quitar sabor">
                        <Icon name="close" size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button type="button" variant="outline" onClick={addFila} style={{ marginTop: 12 }}>
            <Icon name="plus" size={13} /> Agregar sabor
          </Button>

          {!!resultados.sinConfigurar.length && (
            <div className="calculadora-aviso">
              <Icon name="alertTriangle" size={13} />
              Sin "unidades por lote" configuradas, no se pueden calcular: {resultados.sinConfigurar.join(', ')} — editalas en Procesos.
            </div>
          )}

          {!!resultados.filasInsumos.length && (
            <div className="calculadora-resultado-section">
              <h2 className="subsection-title">Costo por insumo — {fmtCOP(resultados.totalGeneral)}</h2>
              <table className="calculadora-table">
                <thead><tr><th>Insumo</th><th>Cantidad</th><th>Costo</th></tr></thead>
                <tbody>
                  {resultados.filasInsumos.map(f => (
                    <tr key={f.nombre}>
                      <td>{f.nombre}</td>
                      <td>{f.cantidad.toLocaleString('es-CO', { maximumFractionDigits: 2 })} {f.unidad}</td>
                      <td>{fmtCOP(f.costo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!!resultados.incompletos.length && (
                <div className="calculadora-aviso">
                  <Icon name="alertTriangle" size={13} />
                  Sin compras registradas, no se pudieron sumar: {resultados.incompletos.join(', ')}.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
