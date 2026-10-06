import { useCallback, useEffect, useMemo, useState } from 'react';
import * as qrApi from '../../services/qrApi';

// Toda la lógica de negocio de QR vive acá — mismo patrón que el resto de
// los módulos migrados.
export function useQR() {
  const [qrs, setQrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    const list = await qrApi.fetchQRs();
    setQrs(list);
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await qrApi.ensureQRSheet();
        if (cancelled) return;
        await reload();
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reload]);

  // Más nuevo primero.
  const rows = useMemo(
    () => [...qrs].sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || '')),
    [qrs]
  );

  const generarQR = useCallback(async ({ nombre, link }) => {
    const linkNormalizado = qrApi.normalizeQRLink(link);
    if (!nombre.trim()) throw new Error('El nombre es obligatorio.');
    if (!linkNormalizado) throw new Error('El link es obligatorio.');
    const imagen = await qrApi.generateQRDataURL(linkNormalizado);
    await qrApi.appendQR({ nombre: nombre.trim(), link: linkNormalizado, imagen });
    await reload();
    return imagen;
  }, [reload]);

  const deleteQR = useCallback(async rowIndex => {
    await qrApi.deleteQRRow(rowIndex);
    await reload();
  }, [reload]);

  return { loading, error, rows, generarQR, deleteQR };
}
