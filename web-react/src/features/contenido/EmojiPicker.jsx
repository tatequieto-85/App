import { useState } from 'react';
import { INSTAGRAM_EMOJIS } from './emojis';
import './EmojiPicker.css';

// Toggle + panel de emojis para insertar en un <textarea> controlado — en
// el cursor si hay foco/selección, al final si no. Portado de
// initEmojiPicker()/insertEmoji() en ../../../contenido.js.
export default function EmojiPicker({ textareaRef, value, onChange }) {
  const [open, setOpen] = useState(false);

  function insert(emoji) {
    const ta = textareaRef.current;
    const start = ta ? ta.selectionStart : value.length;
    const end   = ta ? ta.selectionEnd   : value.length;
    onChange(value.slice(0, start) + emoji + value.slice(end));
    setOpen(false);
    if (ta) {
      requestAnimationFrame(() => {
        ta.focus();
        ta.selectionStart = ta.selectionEnd = start + emoji.length;
      });
    }
  }

  return (
    <>
      <button type="button" className="btn-emoji-toggle" onClick={() => setOpen(v => !v)}>
        Emoji
      </button>
      {open && (
        <div className="emoji-panel open">
          {INSTAGRAM_EMOJIS.map(e => (
            <button key={e} type="button" className="emoji-btn" onClick={() => insert(e)}>{e}</button>
          ))}
        </div>
      )}
    </>
  );
}
