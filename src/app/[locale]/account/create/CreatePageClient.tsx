"use client";

import { useState } from "react";
import OnboardingChat from "./OnboardingChat";
import ProfilePreviewCard from "./ProfilePreviewCard";
import { CollectedData } from "@/app/api/onboarding/chat/types";

interface Category {
  id: string;
  name_pt: string;
}
interface Bairro {
  id: string;
  name: string;
}

interface Props {
  categories: Category[];
  bairros: Bairro[];
}

export default function CreatePageClient({ categories, bairros }: Props) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<CollectedData | null>(null);
  const [correctionKey, setCorrectionKey] = useState(0);

  function handleComplete(data: CollectedData) {
    setPreviewData(data);
    setShowPreview(true);
  }

  function handleCorrect() {
    setShowPreview(false);
    setCorrectionKey((k) => k + 1);
  }

  return (
    <div>
      <div className={showPreview ? "hidden" : undefined}>
        <OnboardingChat onComplete={handleComplete} correctionKey={correctionKey} />
      </div>
      {showPreview && previewData && (
        <ProfilePreviewCard
          data={previewData}
          categories={categories}
          bairros={bairros}
          onCorrect={handleCorrect}
        />
      )}
    </div>
  );
}
