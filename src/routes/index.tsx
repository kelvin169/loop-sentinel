import { createFileRoute } from "@tanstack/react-router";
import { ConsoleApp } from "@/components/console/console-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <ConsoleApp />;
}
