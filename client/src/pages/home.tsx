import { useState } from "react";
import { BuzzlyStudio } from "@/components/studio/buzzly-studio";
import { StudioOnboarding, type StudioGoal } from "@/components/studio/studio-onboarding";

export default function Home() {
  const [selectedGoal, setSelectedGoal] = useState<StudioGoal | null>(null);

  if (!selectedGoal) {
    return <StudioOnboarding onStart={setSelectedGoal} />;
  }

  return (
    <BuzzlyStudio
      initialGoal={selectedGoal}
      onChangeGoal={() => setSelectedGoal(null)}
    />
  );
}
