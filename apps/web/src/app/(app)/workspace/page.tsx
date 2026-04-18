import { redirect } from "next/navigation";

/** Overview / agentic workspace removed; keep URL for bookmarks. */
export default function WorkspacePage() {
  redirect("/history");
}
