import { useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Icon from '../../components/icons/Icon';
import Select from '../../components/ui/Select';
import TextField from '../../components/ui/TextField';
import { useCalculadora } from './useCalculadora';
import { computeCostoRecetaEscalado } from '../../services/recetasApi';
import { normalizeIngName } from '../../services/ingredientesApi';
import { getStockDisponibleGeneral } from '../../services/stockApi';
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
  const { recetas, compras, ingredientes, ejecuciones, ferias, stockMovimientos, loading, error } = useCalculadora();
  const [filas, setFilas] = useState([nuevaFila()]);
  // Selección de insumos puntuales en la tabla de abajo, para ir sumando
  // un total aparte — a pedido explícito del usuario ("que se deje
  // seleccionar algunos insumos calculados y vayan sumando el total"), p.
  // ej. para armar la lista de lo que se va a comprar HOY nada más. Por
  // nombre de insumo (clave estable de esa tabla, ver filasInsumos).
  const [seleccionados, setSeleccionados] = useState(new Set());

  function toggleSeleccionado(nombre) {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(nombre)) next.delete(nombre); else next.add(nombre);
      return next;
    });
  }

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
    const stockPorFila = {};
    const stockCtx = { ejecuciones, ferias, stockMovimientos };

    filas.forEach(f => {
      const receta = recetas.find(r => r.id === f.recetaId);
      const cantidadPedida = parseInt(f.cantidad, 10) || 0;
      if (!receta || !cantidadPedida) return;
      if (!receta.unidadesPorLote) {
        if (!sinConfigurar.includes(receta.nombre)) sinConfigurar.push(receta.nombre);
        return;
      }
      // Si ya hay unidades de este sabor hechas y sin vender (ver Stock),
      // no hace falta producirlas de nuevo — a pedido explícito del
      // usuario ("si pongo 10 y hay tres debe aclararlo"): la cuenta de
      // insumos/costo se hace sobre lo que REALMENTE falta producir, no
      // sobre el total pedido.
      const stockDisponible = Math.max(0, getStockDisponibleGeneral(stockCtx, receta.id));
      const cantidadNum = Math.max(0, cantidadPedida - stockDisponible);
      stockPorFila[f.id] = { cantidadPedida, stockDisponible, aProducir: cantidadNum };
      if (!cantidadNum) return;
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

    // "Falta comprar" — a pedido explícito del usuario: de lo que necesitan
    // las recetas elegidas, lo que ya hay en stock (ver columna "Stock" de
    // Ingredientes/Inventario) no hace falta comprarlo. El precio unitario
    // sale del mismo costo ya calculado (costo/cantidad) — ningún insumo
    // sin precio registrado llega hasta acá (computeCostoRecetaEscalado ya
    // lo deja afuera y lo manda a `incompletos`), así que no hace falta
    // volver a resolverlo contra Compras.
    let totalFaltante = 0;
    const filasInsumos = [...porInsumo.values()].map(f => {
      const ing = ingredientes.find(i => normalizeIngName(i.nombre) === normalizeIngName(f.nombre));
      const stockActual = ing?.stock ?? 0;
      const faltante = Math.max(0, f.cantidad - stockActual);
      const unitPrice = f.cantidad ? f.costo / f.cantidad : 0;
      const costoFaltante = faltante * unitPrice;
      totalFaltante += costoFaltante;
      return { ...f, stockActual, faltante, costoFaltante };
    }).sort((a, b) => b.costoFaltante - a.costoFaltante);

    return {
      filasInsumos,
      incompletos: [...incompletos],
      sinConfigurar,
      totalGeneral,
      totalFaltante,
      porFila,
      stockPorFila
    };
  }, [filas, recetas, compras, ingredientes, ejecuciones, ferias, stockMovimientos]);

  const totalSeleccionado = resultados.filasInsumos
    .filter(f => seleccionados.has(f.nombre) && f.faltante > 0)
    .reduce((s, f) => s + f.costoFaltante, 0);

  function recetaLabel(r) {
    return r.unidadesPorLote ? `${r.nombre} (${r.unidadesPorLote}/lote)` : `${r.nombre} (sin configurar)`;
  }

  // Una receta ya elegida en OTRA fila no vuelve a aparecer en el
  // desplegable — a pedido explícito del usuario, para no repetir el
  // mismo sabor dos veces por error. La fila que ya la tiene elegida sigue
  // viéndola (si no, el Select quedaría sin poder mostrar su propio valor).
  function opcionesPara(filaId) {
    const elegidasEnOtras = new Set(filas.filter(x => x.id !== filaId && x.recetaId).map(x => x.recetaId));
    return recetas.filter(r => !elegidasEnOtras.has(r.id)).map(r => ({ value: r.id, label: recetaLabel(r) }));
  }

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
                      options={[{ value: '', label: 'Elegí una receta' }, ...opcionesPara(f.id)]}
                    />
                    <TextField
                      label="Unidades" type="number" min="0" step="1" placeholder="0"
                      value={f.cantidad} onChange={e => updateFila(f.id, 'cantidad', e.target.value)}
                    />
                  </div>
                  {resultados.stockPorFila[f.id]?.stockDisponible > 0 && (
                    <p className="calculadora-fila-stock-aviso">
                      {resultados.stockPorFila[f.id].aProducir > 0
                        ? `Ya tenés ${resultados.stockPorFila[f.id].stockDisponible} en stock sin vender — hace falta producir ${resultados.stockPorFila[f.id].aProducir} más.`
                        : `Ya tenés ${resultados.stockPorFila[f.id].stockDisponible} en stock sin vender — no hace falta producir más.`}
                    </p>
                  )}
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
              <p className="calculadora-falta-total">
                Falta comprar (según stock actual): <strong>{fmtCOP(resultados.totalFaltante)}</strong>
              </p>
              {!!seleccionados.size && (
                <p className="calculadora-falta-total calculadora-seleccion-total">
                  Seleccionado ({seleccionados.size}): <strong>{fmtCOP(totalSeleccionado)}</strong>
                </p>
              )}
              <div className="calculadora-table-wrap">
                <table className="calculadora-table">
                  <thead><tr><th></th><th>Insumo</th><th>Costo de faltante</th><th>Cantidad faltante</th></tr></thead>
                  <tbody>
                    {resultados.filasInsumos.map(f => (
                      <tr
                        key={f.nombre}
                        className={seleccionados.has(f.nombre) ? 'calculadora-row-seleccionada' : ''}
                        onClick={() => toggleSeleccionado(f.nombre)}
                      >
                        <td className="calculadora-td-check">
                          <input
                            type="checkbox" checked={seleccionados.has(f.nombre)}
                            onChange={() => toggleSeleccionado(f.nombre)}
                            onClick={e => e.stopPropagation()}
                          />
                        </td>
                        <td>{f.nombre}</td>
                        <td>{f.faltante > 0 ? fmtCOP(f.costoFaltante) : '— ya hay stock'}</td>
                        <td>{f.faltante > 0 ? `${f.faltante.toLocaleString('es-CO', { maximumFractionDigits: 2 })} ${f.unidad}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
