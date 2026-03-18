"use client";
import { useState } from "react";

export default function PhotoGallery({ photos, name }: { photos: string[]; name: string }) {
  const [selected, setSelected] = useState(0);

  if (photos.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photos[selected]}
        alt={name}
        className="w-full h-72 object-cover rounded-xl"
      />
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {photos.map((url, i) => (
            <button key={url} onClick={() => setSelected(i)} className="flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${name} ${i + 1}`}
                className={`w-16 h-16 object-cover rounded-lg border-2 transition-colors ${
                  i === selected ? "border-accent" : "border-transparent"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
