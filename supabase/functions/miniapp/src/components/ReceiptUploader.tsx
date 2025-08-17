import { ChangeEvent, useEffect, useState } from "react";

interface Props {
  onChange: (file: File | null) => void;
}

export default function ReceiptUploader({ onChange }: Props) {
  const [preview, setPreview] = useState<string>("");

  function handle(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;

    // Revoke previous object URL to avoid memory leaks
    if (preview) URL.revokeObjectURL(preview);

    onChange(file);

    if (file) setPreview(URL.createObjectURL(file));
    else setPreview("");
  }

  // Clean up object URL when component unmounts or preview changes
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <div>
      {preview && (
        <img
          src={preview}
          alt="Receipt preview"
          className="mb-2 w-full rounded-lg"
        />
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
