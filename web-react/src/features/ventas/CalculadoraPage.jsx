import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Icon from '../../components/icons/Icon';
import Select from '../../components/ui/Select';
import TextField from '../../components/ui/TextField';
import { useCalculadora } from './useCalculadora';
import { computeCostoRecetaMedida } from '../../services/recetasApi';
import { normalizeIngName } from '../../services/ingredientesApi';
import { getStockDisponibleGeneral } from '../../services/stockApi';
import { fmtCOP } from '../../utils/format';
import './CalculadoraPage.css';

let nextRowId = 1;
function nuevaFila() {
  return { id: nextRowId++, recetaId: '', medidaId: '', cantidad: '' };
}

// "Necesito hacer 5 de este sabor, 29 de este sabor" — a pedido explícito
// del usuario: elegís varias recetas, con QUÉ MEDIDA (tamaño de empaque,
// del catálogo de Medidas — ver medidasApi.js) y cuántas UNIDADES finales
// de esa medida querés sacar, y acá se calcula cuánto cuesta en insumos,
// según los últimos
// precios de Compras (mismo criterio que el costo estimado de una receta en
// Procesos). Cada receta escala sus insumos de peso según el peso de esa
// medida (ver computeCostoRecetaMedida en recetasApi.js) y le suma los
// insumos unitarios (frasco/etiqueta/tapa) de esa medida puntual — una
// receta sin medidas configuradas no se puede calcular, queda afuera de la
// cuenta con un aviso. No guarda nada — es una calculadora de verdad.
// La última configuración (filas + insumos tildados) queda guardada en este
// dispositivo y se restaura al volver — a pedido explícito del usuario.
// "Poner todo en blanco" la borra.
const STORAGE_KEY = 'ss_calculadora_config';

function cargarConfig() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const filas = Array.isArray(raw?.filas) ? raw.filas.filter(f => f && f.id != null) : [];
    if (filas.length) {
      nextRowId = Math.max(nextRowId, ...filas.map(f => Number(f.id) || 0)) + 1;
      return { filas, seleccionados: Array.isArray(raw.seleccionados) ? raw.seleccionados : [] };
    }
  } catch { /* sin storage o JSON roto: arranca en blanco */ }
  return { filas: [nuevaFila()], seleccionados: [] };
}

export default function CalculadoraPage() {
  const { recetas, compras, ingredientes, ejecuciones, ferias, stockMovimientos, medidas, loading, error } = useCalculadora();
  const [inicial] = useState(cargarConfig);
  const [filas, setFilas] = useState(inicial.filas);

  function medidasDeReceta(recetaId) {
    return medidas.filter(m => m.recetaId === recetaId);
  }
  // Selección de insumos puntuales en la tabla de abajo, para ir sumando
  // un total aparte — a pedido explícito del usuario ("que se deje
  // seleccionar algunos insumos calculados y vayan sumando el total"), p.
  // ej. para armar la lista de lo que se va a comprar HOY nada más. Por
  // nombre de insumo (clave estable de esa tabla, ver filasInsumos).
  const [seleccionados, setSeleccionados] = useState(() => new Set(inicial.seleccionados));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ filas, seleccionados: [...seleccionados] }));
    } catch { /* sin storage: simplemente no se recuerda */ }
  }, [filas, seleccionados]);

  function limpiarTodo() {
    if (!window.confirm('¿Poner todo en blanco? Se borran los sabores, medidas, unidades e insumos seleccionados.')) return;
    setFilas([nuevaFila()]);
    setSeleccionados(new Set());
  }

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
    // El stock es por receta: si el mismo sabor está en varias filas
    // (medidas distintas), se descuenta una sola vez entre todas.
    const stockUsado = {};

    filas.forEach(f => {
      const receta = recetas.find(r => r.id === f.recetaId);
      const cantidadPedida = parseInt(f.cantidad, 10) || 0;
      if (!receta || !cantidadPedida) return;
      const medidasReceta = medidasDeReceta(receta.id);
      if (!medidasReceta.length) {
        if (!sinConfigurar.includes(receta.nombre)) sinConfigurar.push(receta.nombre);
        return;
      }
      const medidaSel = medidasReceta.find(m => m.id === f.medidaId);
      if (!medidaSel) return;
      // Si ya hay unidades de este sabor hechas y sin vender (ver Stock),
      // no hace falta producirlas de nuevo — a pedido explícito del
      // usuario ("si pongo 10 y hay tres debe aclararlo"): la cuenta de
      // insumos/costo se hace sobre lo que REALMENTE falta producir, no
      // sobre el total pedido.
      const stockDisponible = Math.max(0, getStockDisponibleGeneral(stockCtx, receta.id) - (stockUsado[receta.id] || 0));
      const cantidadNum = Math.max(0, cantidadPedida - stockDisponible);
      stockUsado[receta.id] = (stockUsado[receta.id] || 0) + Math.min(stockDisponible, cantidadPedida);
      stockPorFila[f.id] = { cantidadPedida, stockDisponible, aProducir: cantidadNum };
      if (!cantidadNum) return;
      const { total, incompleto, detalle } = computeCostoRecetaMedida(compras, receta, medidaSel, cantidadNum);
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
  }, [filas, recetas, medidas, compras, ingredientes, ejecuciones, ferias, stockMovimientos]);

  const totalSeleccionado = resultados.filasInsumos
    .filter(f => seleccionados.has(f.nombre) && f.faltante > 0)
    .reduce((s, f) => s + f.costoFaltante, 0);

  function recetaLabel(r) {
    return medidasDeReceta(r.id).length ? r.nombre : `${r.nombre} (sin medidas)`;
  }

  // Una receta ya elegida en OTRA fila no vuelve a aparecer en el
  // desplegable — a pedido explícito del usuario, para no repetir el
  // mismo sabor dos veces por error. La fila que ya la tiene elegida sigue
  // viéndola (si no, el Select quedaría sin poder mostrar su propio valor).
  // Una receta puede repetirse en varias filas siempre que sea con medidas
  // distintas (bug real: al querer agregar otra medida del mismo sabor, la
  // receta desaparecía del desplegable). Solo se oculta cuando ya no le
  // queda ninguna medida libre (o no tiene medidas y ya está en otra fila).
  function medidasLibres(recetaId, filaId) {
    const tomadas = new Set(filas.filter(x => x.id !== filaId && x.recetaId === recetaId && x.medidaId).map(x => x.medidaId));
    return medidasDeReceta(recetaId).filter(m => !tomadas.has(m.id));
  }
  function opcionesPara(filaId) {
    return recetas.filter(r => {
      if (!medidasDeReceta(r.id).length) {
        return !filas.some(x => x.id !== filaId && x.recetaId === r.id);
      }
      return medidasLibres(r.id, filaId).length > 0;
    }).map(r => ({ value: r.id, label: recetaLabel(r) }));
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
                      onChange={e => setFilas(fs => fs.map(x => x.id === f.id ? { ...x, recetaId: e.target.value, medidaId: '' } : x))}
                      options={[{ value: '', label: 'Elegí una receta' }, ...opcionesPara(f.id)]}
                    />
                    {!!f.recetaId && !!medidasDeReceta(f.recetaId).length && (
                      <Select
                        label="Medida" value={f.medidaId}
                        onChange={e => updateFila(f.id, 'medidaId', e.target.value)}
                        options={[
                          { value: '', label: 'Elegí…' },
                          ...medidasLibres(f.recetaId, f.id).map(m => ({ value: m.id, label: m.nombre }))
                        ]}
                      />
                    )}
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
          <Button type="button" variant="outline" onClick={limpiarTodo} style={{ marginTop: 12, marginLeft: 8 }}>
            Poner todo en blanco
          </Button>

          {!!resultados.sinConfigurar.length && (
            <div className="calculadora-aviso">
              <Icon name="alertTriangle" size={13} />
              Sin medidas configuradas, no se pueden calcular: {resultados.sinConfigurar.join(', ')} — editalas en Procesos.
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
