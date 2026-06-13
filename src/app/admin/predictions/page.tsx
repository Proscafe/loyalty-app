import { redirect } from "next/navigation";

export default function AdminPredictionsRedirectPage() {
  redirect("/admin/games");
}
