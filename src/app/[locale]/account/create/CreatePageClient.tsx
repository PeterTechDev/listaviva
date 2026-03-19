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
  const [collectedData, setCollectedData] = useState<CollectedData | null>(null);

  if (collectedData) {
    return (
      <ProfilePreviewCard
        data={collectedData}
        categories={categories}
        bairros={bairros}
        onCorrect={() => setCollectedData(null)}
      />
    );
  }

  return <OnboardingChat onComplete={setCollectedData} />;
}
