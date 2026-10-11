import { useEffect } from "react";
import { Container } from "../components/ui";
import { SpaceHeroCard } from "../components/SpaceHeroCard";
import { MemoryScratchCard } from "../components/MemoryScratchCard";
import { setPageTitle } from "../lib/pageTitle";

export function UsPage() {
  useEffect(() => {
    setPageTitle("我们");
  }, []);

  return (
    <Container size="standard" className="space-y-4">
      <SpaceHeroCard />
      <MemoryScratchCard />
    </Container>
  );
}
