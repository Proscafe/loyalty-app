import { BOFrame } from "../BOFrame";
import { HomeDashboard } from "./HomeDashboard";

export default function HomePage() {
  return <BOFrame active="/bo/home" title="BACK OFFICE" subtitle="Live overview of menu, inventory, production and reviews.">
    <HomeDashboard />
  </BOFrame>;
}
