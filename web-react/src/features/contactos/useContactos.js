import { useCallback, useEffect, useState } from 'react';
import * as api from '../../services/contactosApi';

// Toda la lógica de negocio de Contactos vive acá.
export function useContactos() {
  const [contactos, setContactos] = useState([]);
  const [relaciones, setRelaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    const [c, r] = await Promise.all([api.fetchContactos(), api.fetchRelaciones()]);
    setContactos(c);
    setRelaciones(r);
    return { contactos: c, relaciones: r };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await api.ensureContactosSheets();
        if (!cancelled) await reload();
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reload]);

  const saveContacto = useCallback(async (datos, editingId) => {
    if (editingId) {
      const existente = contactos.find(c => c.id === editingId);
      if (existente) await api.updateContacto({ ...existente, ...datos });
    } else {
      await api.appendContacto(datos);
    }
    await reload();
  }, [contactos, reload]);

  // Borrar un contacto también borra sus vínculos (en ambas direcciones)
  // para no dejar relaciones huérfanas.
  const deleteContacto = useCallback(async c => {
    const related = api.relacionesDe(contactos, relaciones, c.id)
      .slice()
      .sort((a, b) => b.rowIndex - a.rowIndex);
    for (const r of related) await api.deleteRelacionRow(r.rowIndex);
    await api.deleteContactoRow(c.rowIndex);
    await reload();
  }, [contactos, relaciones, reload]);

  const addRelacion = useCallback(async (contactoAId, contactoBId, categoria, tipo) => {
    await api.appendRelacion(contactoAId, contactoBId, categoria, tipo);
    await reload();
  }, [reload]);

  const removeRelacion = useCallback(async rowIndex => {
    await api.deleteRelacionRow(rowIndex);
    await reload();
  }, [reload]);

  const addObservacion = useCallback(async (contacto, text) => {
    await api.appendObservacion(contacto, text);
    await reload();
  }, [reload]);

  const relacionesDe = useCallback(
    contactoId => api.relacionesDe(contactos, relaciones, contactoId),
    [contactos, relaciones]
  );

  const empresas = [...new Set(contactos.map(c => c.empresa).filter(Boolean))].sort();
  const ciudades = [...new Set(contactos.map(c => c.ciudad).filter(Boolean))].sort();
  const categorias = api.categoriasDeRelacion(relaciones);

  return {
    contactos, relaciones, loading, error,
    empresas, ciudades, categorias,
    relacionesDe, saveContacto, deleteContacto, addRelacion, removeRelacion, addObservacion
  };
}
