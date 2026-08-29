export type ReportType =
  | "floor_checklist"
  | "floor_report"
  | "kitchen_checklist"
  | "kitchen_report";

export type ReportQuestionKind =
  | "yes_no"
  | "yes_no_na"
  | "short"
  | "paragraph";

export type ReportQuestion = {
  key: string;
  label: string;
  kind: ReportQuestionKind;
  required?: boolean;
};

export type ReportSection = {
  title: string;
  questions: ReportQuestion[];
};

export type ReportDefinition = {
  type: ReportType;
  title: string;
  description?: string;
  sections: ReportSection[];
  is_active?: boolean;
};

export const REPORT_TYPES: ReportType[] = [
  "floor_checklist",
  "floor_report",
  "kitchen_checklist",
  "kitchen_report",
];

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    type: "floor_checklist",
    title: "Floor Checklist",
    description: "Opening and closing floor checklist.",
    sections: [
      {
        title: "Opening",
        questions: [
          ["opening_bar_clean_ready", "Bar clean & ready?", "yes_no", true],
          ["opening_hookah_area_clean_ready", "Hookah area clean & ready?", "yes_no", true],
          ["opening_playground_clean_ready", "Playground clean & ready?", "yes_no", true],
          ["opening_entrance_clean_ready", "Entrance clean & ready?", "yes_no", true],
          ["opening_kitchen_clean_ready", "Kitchen clean & ready?", "yes_no", true],
          ["opening_tables_chairs_clean", "Tables & chairs clean?", "yes_no", true],
          ["opening_floors_clean", "Floors clean?", "yes_no", true],
          ["opening_windows_clean", "Windows clean?", "yes_no", true],
          ["opening_bathrooms_clean", "Bathrooms clean?", "yes_no", true],
          ["opening_lights_working", "Lights working?", "yes_no", true],
          ["opening_ac_working", "AC working?", "yes_no", true],
          ["opening_music_working", "Music working?", "yes_no", true],
          ["opening_equipment_working", "Equipment working?", "yes_no", true],
          ["opening_pos_working", "POS working?", "yes_no", true],
          ["opening_issues", "Any issues?", "short", false],
        ].map(([key, label, kind, required]) => ({ key, label, kind, required })) as ReportQuestion[],
      },
      {
        title: "Closing",
        questions: [
          ["closing_stock_refilled", "Stock refilled?", "yes_no", true],
          ["closing_pos_cash_closed", "POS & cash closed?", "yes_no_na", true],
          ["closing_equipment_lights_off", "Equipment & lights off?", "yes_no", true],
          ["closing_ac_off", "AC off?", "yes_no", true],
          ["closing_doors_windows_secured", "Doors & windows secured?", "yes_no", true],
          ["closing_storage_secured", "Storage secured?", "yes_no", true],
          ["closing_issues", "Any issues?", "short", false],
        ].map(([key, label, kind, required]) => ({ key, label, kind, required })) as ReportQuestion[],
      },
    ],
  },
  {
    type: "floor_report",
    title: "Floor Report",
    sections: [{ title: "Report", questions: [
      { key: "items_86", label: "86 Items", kind: "short", required: true },
      { key: "clients_report", label: "Clients Report", kind: "paragraph", required: true },
      { key: "staff_report", label: "Staff Report", kind: "short", required: true },
    ]}],
  },
  {
    type: "kitchen_checklist",
    title: "Kitchen Checklist",
    description: "Opening and closing kitchen checklist.",
    sections: [
      { title: "Opening", questions: [
        ["opening_kitchen_clean_ready","Kitchen clean & ready?","yes_no",true],
        ["opening_prep_area_clean","Prep area clean?","yes_no",true],
        ["opening_fridges_clean_working","Fridges clean & working?","yes_no",true],
        ["opening_freezers_clean_working","Freezers clean & working?","yes_no",true],
        ["opening_equipment_clean_working","Equipment clean & working?","yes_no",true],
        ["opening_ovens_grills_working","Ovens & grills working?","yes_no",true],
        ["opening_sinks_clean_ready","Sinks clean & ready?","yes_no",true],
        ["opening_floors_clean","Floors clean?","yes_no",true],
        ["opening_storage_clean_organized","Storage clean & organized?","yes_no",true],
        ["opening_food_stock_ready","Food stock ready?","yes_no",true],
        ["opening_expiry_dates_checked","Expiry dates checked?","yes_no",true],
        ["opening_food_stored_properly","Food stored properly?","yes_no",true],
        ["opening_bins_empty_clean","Bins empty & clean?","yes_no",true],
        ["opening_issues","Any issues?","short",false],
      ].map(([key,label,kind,required]) => ({key,label,kind,required})) as ReportQuestion[] },
      { title: "Closing", questions: [
        ["closing_kitchen_cleaned","Kitchen cleaned?","yes_no",true],
        ["closing_equipment_cleaned","Equipment cleaned?","yes_no",true],
        ["closing_fridges_freezers_checked","Fridges & freezers checked?","yes_no",true],
        ["closing_food_stored_covered","Food stored & covered?","yes_no",true],
        ["closing_stock_refilled","Stock refilled?","yes_no",true],
        ["closing_prep_ready_tomorrow","Prep ready for tomorrow?","yes_no",true],
        ["closing_bins_emptied","Bins emptied?","yes_no",true],
        ["closing_equipment_gas_off","Equipment & gas off?","yes_no",true],
        ["closing_storage_secured","Storage secured?","yes_no",true],
        ["closing_issues","Any issues?","short",false],
      ].map(([key,label,kind,required]) => ({key,label,kind,required})) as ReportQuestion[] },
    ],
  },
  {
    type: "kitchen_report",
    title: "Kitchen Report",
    sections: [{ title: "Report", questions: [
      { key: "items_86", label: "86 Items", kind: "short", required: true },
      { key: "service_report", label: "Service Report", kind: "paragraph", required: true },
      { key: "staff_report", label: "Staff Report", kind: "short", required: true },
      { key: "waste_damaged_items", label: "Waste / Damaged Items", kind: "paragraph", required: true },
    ]}],
  },
];

export function getReportDefinition(type: string, definitions: ReportDefinition[] = REPORT_DEFINITIONS) {
  return definitions.find((item) => item.type === type);
}

export function reportTypeLabel(type: string, definitions: ReportDefinition[] = REPORT_DEFINITIONS) {
  return getReportDefinition(type, definitions)?.title ?? type.replaceAll("_", " ");
}

export function reportRoleLabel(role?: string | null) {
  if (role === "staff") return "Manager";
  if (role === "supervisor") return "Supervisor";
  if (role === "master_admin") return "Admin";
  return role || "—";
}
