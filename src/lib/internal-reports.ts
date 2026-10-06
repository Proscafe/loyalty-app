export type ReportType = string;

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

export type ReportFormKind = "report" | "checklist";

export type ReportDefinition = {
  type: ReportType;
  title: string;
  description?: string;
  sections: ReportSection[];
  is_active?: boolean;
  allowed_roles?: string[];
  is_deleted?: boolean;
  form_kind?: ReportFormKind;
};

export const REPORT_TYPES: string[] = [
  "floor_am_checklist",
  "floor_pm_checklist",
  "hostess_checklist",
  "floor_report",
  "kitchen_checklist",
  "kitchen_report",
];

function checklistQuestions(
  prefix: string,
  items: string[],
): ReportQuestion[] {
  return items.map((label, index) => ({
    key: `${prefix}_${index + 1}`,
    label,
    kind: "yes_no",
    required: true,
  }));
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    type: "floor_am_checklist",
    form_kind: "checklist",
    title: "Floor AM Checklist",
    allowed_roles: ["staff", "master_admin"],
    is_deleted: false,
    description: "AM Supervisor daily opening and handover checklist.",
    sections: [
      {
        title: "1. Opening the Restaurant",
        questions: checklistQuestions("floor_am_opening", [
          "Open the restaurant: Make sure the restaurant is fully opened and ready before receiving customers.",
          "Temperature & AC: Check the restaurant temperature and make sure the AC/heating is adjusted according to the weather and customer comfort.",
          "Doors: Make sure all required entrance doors are open and ready.",
          "Systems: Check that all restaurant systems are working properly and ready for operation.",
        ]),
      },
      {
        title: "2. Cleanliness & Preparation",
        questions: checklistQuestions("floor_am_cleanliness", [
          "Overall Cleanliness: Check the cleanliness of the entire restaurant before opening.",
          "Shisha Area: Make sure the shisha area and all shisha equipment are clean and ready.",
          "Bar: Check that the bar is clean, organized, and fully prepared.",
          "Kitchen: Check that the kitchen is clean and ready for service.",
          "Floor: Make sure all floors are clean and properly maintained.",
          "Tables: Make sure all tables are clean, wiped, and properly arranged.",
          "Cutlery: Check that all cutlery is clean, polished, and ready for service.",
          "Glassware: Make sure all glasses are clean and ready for service.",
          "Sections: Make sure all sections are fully stocked and ready for the shift.",
          "Chairs: Check that all chairs are clean and properly arranged.",
          "Playground: Make sure the playground is clean, safe, organized, and ready to receive customers.",
        ]),
      },
      {
        title: "3. Staff & Shift Preparation",
        questions: checklistQuestions("floor_am_staff", [
          "Staff Attendance: Check that all scheduled employees have arrived on time for their shifts.",
          "Staff Readiness: Make sure employees are properly dressed, groomed, and ready to start service.",
          "Section Assignment: Make sure every employee knows their assigned section and responsibilities.",
        ]),
      },
      {
        title: "4. Sales & Upselling",
        questions: checklistQuestions("floor_am_sales", [
          "Daily Upselling Item: Decide and communicate the main item/product to be upsold during today's shift.",
          "Team Briefing: Explain the upselling item to the team and make sure everyone knows how to present and sell it.",
          "Sales Focus: Make sure the team understands today's sales target/focus before service starts.",
        ]),
      },
      {
        title: "5. Final Opening Check",
        questions: checklistQuestions("floor_am_final", [
          "Full Restaurant Walk-Through: Walk through all areas before opening and make sure everything is ready.",
          "Customer Ready: Confirm that the restaurant, staff, tables, playground, bar, kitchen, and shisha area are fully ready to receive customers.",
          "Report Issues: Any missing item, maintenance issue, cleanliness problem, or staff issue must be reported to the manager immediately.",
          "Shift Handover: AM Supervisor must personally brief the incoming PM Supervisor before leaving.",
          "Shift Updates: Explain everything that happened during the AM shift, including any issues, incidents, customer complaints, or pending matters.",
          "Upselling Item: Inform the PM Supervisor about the Upselling Item of the Day and the results achieved during the AM shift, so the PM team continues working on the same item.",
          "Pending Actions: Inform the PM Supervisor about anything that still needs to be followed up during the PM shift.",
          "Main Reading: Send the AM Main Reading before leaving the shift.",
          "Number of Customers: Record and report the total Number of Customers during the AM shift.",
          "Average Check: Record and report the Average Check achieved during the AM shift.",
          "AM Report: Send the complete AM shift report to management/PM Supervisor before leaving.",
          "PM Confirmation: Make sure the PM Supervisor has received and understood all the information before the AM Supervisor leaves.",
        ]),
      },
    ],
  },
  {
    type: "floor_pm_checklist",
    form_kind: "checklist",
    title: "Floor PM Checklist",
    allowed_roles: ["staff", "master_admin"],
    is_deleted: false,
    description: "PM Supervisor daily takeover, monitoring, and closing checklist.",
    sections: [
      {
        title: "A. PM Shift Takeover",
        questions: checklistQuestions("floor_pm_takeover", [
          "Receive the restaurant from the AM Supervisor and review the full handover.",
          "Review all issues, complaints, incidents, and pending matters from AM.",
          "Review the Upselling Item of the Day and continue pushing it with the team.",
          "Check the restaurant temperature and adjust AC/heating if needed.",
          "Check that all restaurant systems are working properly.",
        ]),
      },
      {
        title: "B. Restaurant & Cleanliness Check",
        questions: checklistQuestions("floor_pm_cleanliness", [
          "Check overall cleanliness of the restaurant.",
          "Check shisha area.",
          "Check bar.",
          "Check kitchen.",
          "Check floors.",
          "Check tables and chairs.",
          "Check cutlery and glassware.",
          "Make sure all sections are stocked and ready.",
          "Check the playground and make sure it remains clean and ready.",
        ]),
      },
      {
        title: "C. Staff & Loyalty Monitoring",
        questions: checklistQuestions("floor_pm_staff", [
          "Check staff attendance and make sure the PM team is complete.",
          "Make sure all staff are properly dressed and ready.",
          "Check the hostess regularly and make sure she is welcoming every customer with a smile.",
          "Make sure the hostess is offering Loyalty to every eligible customer.",
          "Make sure Loyalty Cards are being completed for all eligible customers.",
          "Check that Comment Cards are being offered/completed.",
          "Supervisor must continuously walk through all tables and check customer satisfaction.",
          "Follow up and solve customer problems immediately.",
          "Report any serious complaint or issue to management.",
        ]),
      },
      {
        title: "D. Sales & Upselling",
        questions: checklistQuestions("floor_pm_sales", [
          "Make sure the team continues promoting the Upselling Item of the Day.",
          "Monitor upselling performance throughout the PM shift.",
          "Make sure the team is actively communicating with customers and looking for upselling opportunities.",
        ]),
      },
      {
        title: "E. PM Shift Monitoring & Reporting",
        questions: checklistQuestions("floor_pm_monitoring", [
          "Monitor Number of Customers.",
          "Monitor Average Check.",
          "Monitor Loyalty performance.",
          "Monitor upselling performance.",
          "Record all customer complaints, incidents, and operational issues.",
          "Take/send the required mailing / operational reading.",
          "Send the e-check and record how much was achieved during the shift.",
          "Prepare and send the PM Shift Report.",
        ]),
      },
      {
        title: "F. Closing the Restaurant",
        questions: checklistQuestions("floor_pm_closing", [
          "Make sure all sections are clean, organized, and ready for the next day.",
          "Check tables and chairs.",
          "Check cutlery and glassware.",
          "Check the bar.",
          "Check the shisha area.",
          "Check the playground.",
          "Make sure the entire restaurant is clean before closing.",
          "Turn off required lighting.",
          "Turn off required electricity/equipment.",
          "Make sure the motor is turned off at 1:00 AM.",
          "Close and secure all doors and shutters/windows.",
          "Perform a final walk-through of the entire restaurant.",
          "Make sure the restaurant is left in the same clean and organized standard as opening.",
          "Report any remaining issue to management before leaving.",
        ]),
      },
    ],
  },
  {
    type: "hostess_checklist",
    form_kind: "checklist",
    title: "Hostess Checklist",
    allowed_roles: ["staff", "master_admin"],
    is_deleted: false,
    description: "Hostess AM and PM shift checklist.",
    sections: [
      {
        title: "AM Shift",
        questions: checklistQuestions("hostess_am", [
          "Keep smiling & welcoming: Always greet customers with a smile and positive attitude.",
          "Phones: Make sure all phones are charged and operating.",
          "Loyalty Program: Offer and register every eligible customer in the Loyalty Program.",
          "Comment Cards: Make sure every customer is invited to complete the Comment Card.",
          "WC Check: Regularly (every 30 mins) make sure it is clean and well maintained. Report any issue to the manager.",
          "Table Check: Regularly check to ensure they are clean, organized, and ready. Report any issue to the manager.",
          "Temperature: Check that the restaurant temperature is comfortable. Inform the manager if it is too hot or too cold.",
          "WhatsApp Story: Check the WhatsApp Story and make sure the events/promotions are posted and updated.",
          "Customer Welcome: Every customer entering the restaurant must be welcomed with a smile.",
          'Customer Goodbye: Every customer leaving must be thanked and told "Bye Bye" with a smile.',
          "Handover: Report any pending issue, customer complaint, missing item, or operational problem to the manager before leaving.",
        ]),
      },
      {
        title: "PM Shift",
        questions: checklistQuestions("hostess_pm", [
          "Phones Charging: Before leaving, put all phones on the charger.",
          "iPad: Make sure the iPad is connected to the internet and working properly.",
          "Loyalty: Make sure the Loyalty Program was offered to all eligible customers and all registrations were completed.",
          "Comment Cards: Make sure Comment Cards were offered/completed for all customers.",
          "WC Final Check: Check the WC before leaving and make sure it is clean. Report any issue to the manager.",
          "Table Final Check: Make sure all tables and the hostess area are clean and organized before leaving.",
          "Customer Goodbye: Continue welcoming and saying goodbye to customers with a smile until the end of the shift.",
          "Closing Handover: Report any pending issue, customer complaint, missing item, or operational problem to the manager before leaving.",
        ]),
      },
    ],
  },
  {
    type: "floor_report",
    form_kind: "report",
    title: "Floor Report",
    allowed_roles: ["staff", "master_admin"],
    is_deleted: false,
    sections: [
      {
        title: "Report",
        questions: [
          { key: "items_86", label: "86 Items", kind: "short", required: true },
          { key: "clients_report", label: "Clients Report", kind: "paragraph", required: true },
          { key: "staff_report", label: "Staff Report", kind: "short", required: true },
        ],
      },
    ],
  },
  {
    type: "kitchen_checklist",
    form_kind: "checklist",
    title: "Kitchen Checklist",
    allowed_roles: ["supervisor", "master_admin"],
    is_deleted: false,
    description: "Opening and closing kitchen checklist.",
    sections: [
      {
        title: "Opening",
        questions: [
          ["opening_kitchen_clean_ready", "Kitchen clean & ready?", "yes_no", true],
          ["opening_prep_area_clean", "Prep area clean?", "yes_no", true],
          ["opening_fridges_clean_working", "Fridges clean & working?", "yes_no", true],
          ["opening_freezers_clean_working", "Freezers clean & working?", "yes_no", true],
          ["opening_equipment_clean_working", "Equipment clean & working?", "yes_no", true],
          ["opening_ovens_grills_working", "Ovens & grills working?", "yes_no", true],
          ["opening_sinks_clean_ready", "Sinks clean & ready?", "yes_no", true],
          ["opening_floors_clean", "Floors clean?", "yes_no", true],
          ["opening_storage_clean_organized", "Storage clean & organized?", "yes_no", true],
          ["opening_food_stock_ready", "Food stock ready?", "yes_no", true],
          ["opening_expiry_dates_checked", "Expiry dates checked?", "yes_no", true],
          ["opening_food_stored_properly", "Food stored properly?", "yes_no", true],
          ["opening_bins_empty_clean", "Bins empty & clean?", "yes_no", true],
          ["opening_issues", "Any issues?", "short", false],
        ].map(([key, label, kind, required]) => ({
          key,
          label,
          kind,
          required,
        })) as ReportQuestion[],
      },
      {
        title: "Closing",
        questions: [
          ["closing_kitchen_cleaned", "Kitchen cleaned?", "yes_no", true],
          ["closing_equipment_cleaned", "Equipment cleaned?", "yes_no", true],
          ["closing_fridges_freezers_checked", "Fridges & freezers checked?", "yes_no", true],
          ["closing_food_stored_covered", "Food stored & covered?", "yes_no", true],
          ["closing_stock_refilled", "Stock refilled?", "yes_no", true],
          ["closing_prep_ready_tomorrow", "Prep ready for tomorrow?", "yes_no", true],
          ["closing_bins_emptied", "Bins emptied?", "yes_no", true],
          ["closing_equipment_gas_off", "Equipment & gas off?", "yes_no", true],
          ["closing_storage_secured", "Storage secured?", "yes_no", true],
          ["closing_issues", "Any issues?", "short", false],
        ].map(([key, label, kind, required]) => ({
          key,
          label,
          kind,
          required,
        })) as ReportQuestion[],
      },
    ],
  },
  {
    type: "kitchen_report",
    form_kind: "report",
    title: "Kitchen Report",
    allowed_roles: ["supervisor", "master_admin"],
    is_deleted: false,
    sections: [
      {
        title: "Report",
        questions: [
          { key: "items_86", label: "86 Items", kind: "short", required: true },
          { key: "service_report", label: "Service Report", kind: "paragraph", required: true },
          { key: "staff_report", label: "Staff Report", kind: "short", required: true },
          {
            key: "waste_damaged_items",
            label: "Waste / Damaged Items",
            kind: "paragraph",
            required: true,
          },
        ],
      },
    ],
  },
];

export function getReportDefinition(
  type: string,
  definitions: ReportDefinition[] = REPORT_DEFINITIONS,
) {
  return definitions.find((item) => item.type === type);
}

export function reportTypeLabel(
  type: string,
  definitions: ReportDefinition[] = REPORT_DEFINITIONS,
) {
  return (
    getReportDefinition(type, definitions)?.title ??
    type.replaceAll("_", " ")
  );
}

export function reportRoleLabel(role?: string | null) {
  if (role === "staff") return "Manager";
  if (role === "supervisor") return "Supervisor";
  if (role === "master_admin") return "Admin";
  return role || "—";
}


export function getReportFormKind(
  definition: Pick<ReportDefinition, "title" | "type" | "form_kind">,
): ReportFormKind {
  const title = String(definition.title ?? "").trim().toLowerCase();
  const type = String(definition.type ?? "").trim().toLowerCase();

  if (/\breport\b/.test(title) || type.endsWith("_report")) return "report";
  if (definition.form_kind === "report") return "report";
  return "checklist";
}
