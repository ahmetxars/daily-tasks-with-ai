import { createFileRoute } from "@tanstack/react-router";
import { GroveApp } from "@/components/grove/grove-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <GroveApp />;
}
