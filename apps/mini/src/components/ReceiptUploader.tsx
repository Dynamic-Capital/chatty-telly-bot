import { useState, ChangeEvent } from 'react';

interface Props {
  onChange: (file: File | null) => void;
}

export default function ReceiptUploader({ onChange }: Props) {
  const [preview, setPreview] = useState<string>('');

  function handle(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    onChange(file);
    if (file) setPreview(URL.createObjectURL(file));
    else setPreview('');
  }

  return (
    <div>
      {preview && (
        <img src={preview} alt="Receipt preview" className="mb-2 w-full rounded-lg" />
      )}
      <input
        type="file"
        accept="image/*"
        onChange={handle}
        className="dc-input"
        aria-label="Upload receipt"
      />
    </div>
  );
}
