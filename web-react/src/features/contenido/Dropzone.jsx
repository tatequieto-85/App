import { useEffect, useRef, useState } from 'react';
import Icon from '../../components/icons/Icon';
import './Dropzone.css';

// Miniatura de un archivo recién elegido (todavía no subido) — el object
// URL se crea una sola vez por archivo (useState perezoso) y se libera al
// sacarlo de la lista, en vez de recrearse en cada render del formulario.
function PreviewThumb({ file }) {
  const [url] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  if (file.type.startsWith('image/')) return <img src={url} alt="" />;
  if (file.type.startsWith('video/')) return <video src={url} muted />;
  return <div className="preview-icon"><Icon name="folder" size={22} /></div>;
}

function fileKey(file, idx) {
  return `${file.name}-${file.size}-${file.lastModified}-${idx}`;
}

// variant "box": dropzone de arrastrar/soltar (Historias — foto o video).
// variant "button": un botón simple que abre el selector (Ideas de
// marketing — "Tomar/agregar foto"), mismas previews debajo.
export default function Dropzone({ files, onChange, accept, variant = 'box', buttonLabel = 'Agregar foto', capture, disabled }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function addFiles(newFiles) {
    onChange([...files, ...newFiles]);
  }
  function removeAt(idx) {
    onChange(files.filter((_, i) => i !== idx));
  }
  function handleInputChange(e) {
    if (e.target.files.length) addFiles(Array.from(e.target.files));
    e.target.value = '';
  }

  const preview = files.length > 0 && (
    <div className="dropzone-preview">
      {files.map((file, idx) => (
        <div className="preview-item" key={fileKey(file, idx)}>
          <PreviewThumb file={file} />
          <div className="preview-name">{file.name}</div>
          <button type="button" className="preview-remove" onClick={e => { e.stopPropagation(); removeAt(idx); }} title="Quitar">
            <Icon name="close" size={10} />
          </button>
        </div>
      ))}
    </div>
  );

  if (variant === 'button') {
    return (
      <div className="dropzone-button-wrap">
        <input ref={inputRef} type="file" accept={accept} capture={capture} multiple hidden disabled={disabled} onChange={handleInputChange} />
        <button type="button" className="btn btn--outline" disabled={disabled} onClick={() => inputRef.current.click()}>
          <Icon name="camera" size={14} /> {buttonLabel}
        </button>
        {preview}
      </div>
    );
  }

  return (
    <div
      className={`dropzone${dragOver ? ' drag-over' : ''}`}
      onClick={e => { if (!disabled && !e.target.closest('.preview-remove')) inputRef.current.click(); }}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault(); setDragOver(false);
        if (!disabled && e.dataTransfer.files.length) addFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <input ref={inputRef} type="file" accept={accept} multiple hidden disabled={disabled} onChange={handleInputChange} />
      {!files.length && (
        <div className="dropzone-inner">
          <div className="dropzone-icon"><Icon name="upload" size={30} /></div>
          <div className="dropzone-label">Arrastra tu imagen o video<br /><span>o toca para seleccionar</span></div>
        </div>
      )}
      {preview}
    </div>
  );
}
