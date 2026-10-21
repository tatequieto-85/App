import { useCallback, useEffect, useState } from 'react';
import * as api from '../../services/contabilidadApi';

// Toda la lógica de negocio de Contabilidad vive acá: "Cajas" (ingresos/
// egresos manuales + los automáticos que generan Ventas/Compras, ver
// contabilidadApi.js). El "Resumen de ventas por canal" que vivía acá se
// sacó a pedido explícito del usuario — ese tipo de agrupación pasó a
// vivir en Ventas mismo (ver VentasResumen.jsx/useVentas.js), no tiene
// sentido duplicarla en los dos módulos.
export function useContabilidad() {
  const [cajas, setCajas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    const [c, m] = await Promise.all([api.fetchCajas(), api.fetchMovimientos()]);
    setCajas(c);
    setMovimientos(m);
    return { cajas: c, movimientos: m };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await api.ensureContabilidadSheets();
        if (!cancelled) await reload();
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reload]);

  const saveCaja = useCallback(async ({ nombre, fuenteAutomatica }, editingId) => {
    if (fuenteAutomatica !== 'ninguna' && cajas.some(c => c.fuenteAutomatica === fuenteAutomatica && c.id !== editingId)) {
      throw new Error('Ya hay otra caja configurada con esa fuente automática.');
    }
    if (editingId) {
      const caja = cajas.find(c => c.id === editingId);
      await api.updateCaja({ ...caja, nombre, fuenteAutomatica });
    } else {
      await api.appendCaja({ id: crypto.randomUUID(), nombre, fuenteAutomatica, creadoEn: new Date().toISOString() });
    }
    await reload();
  }, [cajas, reload]);

  // Cascada: al borrar una caja se borran también sus movimientos (manuales
  // y automáticos) — de mayor a menor rowIndex, para que borrar uno no
  // invalide el índice de los que todavía faltan (mismo cuidado que
  // pruneOldCompras en comprasApi.js).
  const deleteCaja = useCallback(async cajaId => {
    const caja = cajas.find(c => c.id === cajaId);
    if (!caja) return;
    const propios = movimientos.filter(m => m.cajaId === cajaId).slice().sort((a, b) => b.rowIndex - a.rowIndex);
    for (const m of propios) await api.deleteMovimientoRow(m.rowIndex);
    await api.deleteCajaRow(caja.rowIndex);
    await reload();
  }, [cajas, movimientos, reload]);

  const addMovimiento = useCallback(async (cajaId, { tipo, monto, concepto, fecha }) => {
    await api.appendMovimiento({ id: crypto.randomUUID(), cajaId, tipo, monto, concepto, fecha, origen: 'manual' });
    await reload();
  }, [reload]);

  // Transferencia entre dos cajas propias — a pedido explícito del usuario
  // ("un movimiento puede crear un ingreso, un egreso o una transferencia
  // dentro de las cajas disponibles"). Son dos filas (egreso en origen,
  // ingreso en destino) con el mismo monto, atadas por un origenRefId
  // compartido para poder borrarlas juntas (ver removeMovimiento) — nunca
  // debería quedar una transferencia "a medias".
  const addTransferencia = useCallback(async (origenCajaId, destinoCajaId, monto, concepto, fecha) => {
    const origen = cajas.find(c => c.id === origenCajaId);
    const destino = cajas.find(c => c.id === destinoCajaId);
    const transferId = crypto.randomUUID();
    const base = { monto, fecha, origen: 'manual', origenRefId: transferId };
    await api.appendMovimiento({ id: crypto.randomUUID(), cajaId: origenCajaId, tipo: 'egreso', concepto: concepto || `Transferencia a ${destino?.nombre || ''}`, ...base });
    await api.appendMovimiento({ id: crypto.randomUUID(), cajaId: destinoCajaId, tipo: 'ingreso', concepto: concepto || `Transferencia desde ${origen?.nombre || ''}`, ...base });
    await reload();
  }, [cajas, reload]);

  // Los movimientos automáticos no se borran a mano desde acá — se van
  // solos si se borra la compra/venta que los generó (ver useCompras.js/
  // useVentas.js). Quien llama a esto ya filtra por origen==='manual'. Si
  // el movimiento es la mitad de una transferencia (comparte origenRefId
  // con otro), se borran las dos filas juntas — nunca una sola mitad.
  const removeMovimiento = useCallback(async movimientoId => {
    const mov = movimientos.find(m => m.id === movimientoId);
    if (!mov) return;
    const porBorrar = mov.origenRefId
      ? movimientos.filter(m => m.origenRefId === mov.origenRefId)
      : [mov];
    // De mayor a menor rowIndex, para que borrar uno no invalide el índice
    // de los que todavía faltan.
    for (const m of porBorrar.slice().sort((a, b) => b.rowIndex - a.rowIndex)) {
      await api.deleteMovimientoRow(m.rowIndex);
    }
    await reload();
  }, [movimientos, reload]);

  return {
    cajas, movimientos, loading, error,
    saveCaja, deleteCaja, addMovimiento, addTransferencia, removeMovimiento,
    saldoCaja: cajaId => api.cajaSaldo(movimientos, cajaId)
  };
}
