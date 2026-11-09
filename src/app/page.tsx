import { redirect } from "next/navigation";

/** `/` opens the landing page. */
export default function Home() {
  redirect("/landing");
}
