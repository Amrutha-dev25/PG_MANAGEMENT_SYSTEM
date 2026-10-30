// Client-safe metadata describing every managed table: form fields, list columns, permissions.
// (SQL for each resource lives server-side in resource-sql.ts.)
// Column names below are EXACTLY the column names of the relational schema.
export type Role = "ADMIN" | "STAFF" | "RESIDENT";
export type FieldType = "text" | "textarea" | "number" | "money" | "date" | "time" | "email" | "select" | "ref" | "multiref" | "tags" | "boolean";

export interface Field {
  name: string; label: string; type: FieldType; required?: boolean;
  options?: string[];
  ref?: { resource: string; dependsOn?: string };
  hint?: string; placeholder?: string; min?: number; max?: number; maxLength?: number; pattern?: string; patternMsg?: string;
  readOnlyOnEdit?: boolean; createOnly?: boolean; virtual?: boolean; adminOnly?: boolean;
}
export type ColKind = "text" | "money" | "date" | "badge" | "number" | "time" | "pct" | "days";
export interface Column { key: string; label: string; kind?: ColKind; sortable?: boolean; adminOnly?: boolean }
export interface FilterDef { name: string; label: string; options?: string[]; ref?: string }
export interface Resource {
  key: string; title: string; singular: string; icon: string; description: string; path: string;
  pk: string[]; fields: Field[]; columns: Column[]; filters: FilterDef[];
  perms: { read: Role[]; create: Role[]; update: Role[]; delete: Role[] };
}

const ADM: Role[] = ["ADMIN"];
const OPS: Role[] = ["ADMIN", "STAFF"];
const ALL: Role[] = ["ADMIN", "STAFF", "RESIDENT"];

export const PROPERTY_TYPES = ["Co-living", "Student PG", "Ladies PG", "Gents PG", "Working Professionals"];
export const ROOM_TYPES = ["Single", "Double", "Triple", "Quad", "Dormitory"];
export const BED_TYPES = ["Single", "Bunk-Upper", "Bunk-Lower"];
export const GENDERS = ["Male", "Female", "Other"];
export const ASSET_CONDITIONS = ["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"];
export const PAYMENT_TYPES = ["RENT", "DEPOSIT", "MAINTENANCE", "FOOD", "LATE_FEE", "OTHER"];
export const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"];
export const COMPLAINT_CATEGORIES = ["Maintenance", "Electrical", "Plumbing", "Food", "Cleanliness", "Internet", "Noise", "Security", "Other"];
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
export const COMPLAINT_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
export const ID_TYPES = ["Aadhaar", "PAN", "Passport", "Driving License", "Voter ID", "Other"];
export const DOC_TYPES = ["Aadhaar", "PAN", "Passport", "Driving License", "College ID", "Employee ID", "Police Verification", "Other"];
export const DOC_STATUSES = ["PENDING", "VERIFIED", "REJECTED"];
export const MEAL_TYPES = ["BREAKFAST", "LUNCH", "SNACKS", "DINNER"];
export const FOOD_CATEGORIES = ["Staple", "Main", "Bread", "Side", "Beverage", "Dessert", "Snack"];
export const FOOD_UNITS = ["piece", "plate", "cup", "bowl", "glass", "kg", "litre"];
export const BED_STATUS_EDITABLE = ["AVAILABLE", "MAINTENANCE"];

const PIN = { pattern: "^[0-9]{6}$", patternMsg: "Pincode must be 6 digits", maxLength: 6 };

export const RESOURCES: Record<string, Resource> = {
  property: {
    key: "property", title: "Properties", singular: "Property", icon: "building", path: "/properties",
    description: "PG buildings managed by the organisation.",
    pk: ["Property_ID"],
    fields: [
      { name: "Property_Name", label: "Property name", type: "text", required: true, maxLength: 120 },
      { name: "Property_Type", label: "Type", type: "select", required: true, options: PROPERTY_TYPES },
      { name: "Total_Floor", label: "Total floors", type: "number", required: true, min: 1, max: 60 },
      { name: "Street", label: "Street", type: "text", required: true, maxLength: 160 },
      { name: "City", label: "City", type: "text", required: true, maxLength: 80 },
      { name: "Pincode", label: "Pincode", type: "text", required: true, ...PIN },
      { name: "Description", label: "Description", type: "textarea" },
      { name: "amenities", label: "Amenities provided", type: "multiref", virtual: true, ref: { resource: "amenity" } },
    ],
    columns: [
      { key: "Property_ID", label: "ID" }, { key: "Property_Name", label: "Name", sortable: true },
      { key: "Property_Type", label: "Type", kind: "badge" }, { key: "City", label: "City", sortable: true },
      { key: "Total_Floor", label: "Floors", kind: "number" }, { key: "Room_Count", label: "Rooms", kind: "number" },
      { key: "Bed_Count", label: "Beds", kind: "number" }, { key: "Amenity_Names", label: "Amenities" },
    ],
    filters: [{ name: "Property_Type", label: "Type", options: PROPERTY_TYPES }, { name: "City", label: "City" }],
    perms: { read: OPS, create: ADM, update: ADM, delete: ADM },
  },
  staff: {
    key: "staff", title: "Staff", singular: "Staff member", icon: "users", path: "/staff",
    description: "Employees of each property and their reporting line.",
    pk: ["Staff_ID"],
    fields: [
      { name: "First_Name", label: "First name", type: "text", required: true, maxLength: 60 },
      { name: "Last_Name", label: "Last name", type: "text", required: true, maxLength: 60 },
      { name: "Designation", label: "Designation", type: "text", required: true, maxLength: 80 },
      { name: "Property_ID", label: "Property", type: "ref", required: true, ref: { resource: "property" } },
      { name: "Supervisor_ID", label: "Supervisor", type: "ref", ref: { resource: "staff", dependsOn: "Property_ID" }, hint: "Must work at the same property" },
      { name: "Join_Date", label: "Join date", type: "date", required: true },
      { name: "Salary", label: "Monthly salary (₹)", type: "money", required: true, min: 0, adminOnly: true },
    ],
    columns: [
      { key: "Staff_ID", label: "ID" }, { key: "Full_Name", label: "Name", sortable: true },
      { key: "Designation", label: "Designation", sortable: true }, { key: "Property_Name", label: "Property" },
      { key: "Supervisor_Name", label: "Reports to" }, { key: "Join_Date", label: "Joined", kind: "date", sortable: true },
      { key: "Salary", label: "Salary", kind: "money", adminOnly: true, sortable: true },
    ],
    filters: [{ name: "Property_ID", label: "Property", ref: "property" }],
    perms: { read: OPS, create: ADM, update: ADM, delete: ADM },
  },
  policy: {
    key: "policy", title: "Policies", singular: "Policy", icon: "scroll", path: "/policies",
    description: "House rules and policies that govern each property.",
    pk: ["Policy_ID"],
    fields: [
      { name: "Property_ID", label: "Property", type: "ref", required: true, ref: { resource: "property" } },
      { name: "Policy_Type", label: "Policy type", type: "text", required: true, maxLength: 80, placeholder: "e.g. Visitor Policy" },
      { name: "Description", label: "Description", type: "textarea", required: true },
      { name: "Effective_From", label: "Effective from", type: "date", required: true },
      { name: "Effective_To", label: "Effective to", type: "date", hint: "Leave empty if open-ended" },
    ],
    columns: [
      { key: "Policy_ID", label: "ID" }, { key: "Property_Name", label: "Property" }, { key: "Policy_Type", label: "Type", kind: "badge" },
      { key: "Description", label: "Description" }, { key: "Effective_From", label: "From", kind: "date" }, { key: "Effective_To", label: "To", kind: "date" },
    ],
    filters: [{ name: "Property_ID", label: "Property", ref: "property" }],
    perms: { read: OPS, create: OPS, update: OPS, delete: ADM },
  },
  license: {
    key: "license", title: "Licences", singular: "Licence", icon: "badge", path: "/licenses",
    description: "Statutory licences held by each property, with expiry tracking.",
    pk: ["License_ID"],
    fields: [
      { name: "Property_ID", label: "Property", type: "ref", required: true, ref: { resource: "property" } },
      { name: "License_Type", label: "Licence type", type: "text", required: true, maxLength: 80 },
      { name: "License_Number", label: "Licence number", type: "text", required: true, maxLength: 80 },
      { name: "Issue_Date", label: "Issue date", type: "date", required: true },
      { name: "Expiry_Date", label: "Expiry date", type: "date", required: true },
    ],
    columns: [
      { key: "License_ID", label: "ID" }, { key: "Property_Name", label: "Property" }, { key: "License_Type", label: "Type", sortable: true },
      { key: "License_Number", label: "Number" }, { key: "Issue_Date", label: "Issued", kind: "date" },
      { key: "Expiry_Date", label: "Expires", kind: "date", sortable: true }, { key: "Days_Left", label: "Status", kind: "days" },
    ],
    filters: [{ name: "Property_ID", label: "Property", ref: "property" }],
    perms: { read: OPS, create: ADM, update: ADM, delete: ADM },
  },
  asset: {
    key: "asset", title: "Assets", singular: "Asset", icon: "box", path: "/assets",
    description: "Furniture and appliances owned by a property.",
    pk: ["Asset_ID"],
    fields: [
      { name: "Property_ID", label: "Property", type: "ref", required: true, ref: { resource: "property" } },
      { name: "Asset_Name", label: "Asset name", type: "text", required: true, maxLength: 120 },
      { name: "Asset_Type", label: "Asset type", type: "text", required: true, maxLength: 80, placeholder: "Furniture / Appliance" },
      { name: "Purchase_Date", label: "Purchase date", type: "date", required: true },
      { name: "Condition", label: "Condition", type: "select", required: true, options: ASSET_CONDITIONS },
      { name: "Cost", label: "Cost (₹)", type: "money", required: true, min: 0 },
    ],
    columns: [
      { key: "Asset_ID", label: "ID" }, { key: "Asset_Name", label: "Asset", sortable: true }, { key: "Asset_Type", label: "Type", kind: "badge" },
      { key: "Property_Name", label: "Property" }, { key: "Purchase_Date", label: "Purchased", kind: "date" },
      { key: "Condition", label: "Condition", kind: "badge" }, { key: "Cost", label: "Cost", kind: "money", sortable: true },
    ],
    filters: [{ name: "Property_ID", label: "Property", ref: "property" }, { name: "Condition", label: "Condition", options: ASSET_CONDITIONS }],
    perms: { read: OPS, create: OPS, update: OPS, delete: ADM },
  },
  room: {
    key: "room", title: "Rooms", singular: "Room", icon: "door", path: "/rooms",
    description: "Rooms of each property. Rent is charged per bed per month.",
    pk: ["Room_ID"],
    fields: [
      { name: "Property_ID", label: "Property", type: "ref", required: true, ref: { resource: "property" }, readOnlyOnEdit: true },
      { name: "Room_No", label: "Room number", type: "text", required: true, maxLength: 20 },
      { name: "Room_Type", label: "Room type", type: "select", required: true, options: ROOM_TYPES },
      { name: "Capacity", label: "Capacity (beds)", type: "number", required: true, min: 1, max: 12 },
      { name: "Rent", label: "Rent per bed / month (₹)", type: "money", required: true, min: 0 },
      { name: "Create_Beds", label: "Create beds automatically", type: "boolean", virtual: true, createOnly: true, hint: "Adds one bed per capacity unit" },
    ],
    columns: [
      { key: "Room_ID", label: "ID" }, { key: "Property_Name", label: "Property" }, { key: "Room_No", label: "Room", sortable: true },
      { key: "Room_Type", label: "Type", kind: "badge" }, { key: "Capacity", label: "Capacity", kind: "number" },
      { key: "Rent", label: "Rent / bed", kind: "money", sortable: true }, { key: "Bed_Count", label: "Beds", kind: "number" },
      { key: "Available_Beds", label: "Free", kind: "number" },
    ],
    filters: [{ name: "Property_ID", label: "Property", ref: "property" }, { name: "Room_Type", label: "Type", options: ROOM_TYPES }],
    perms: { read: OPS, create: ADM, update: ADM, delete: ADM },
  },
  bed: {
    key: "bed", title: "Beds", singular: "Bed", icon: "bed", path: "/beds",
    description: "Individual beds. OCCUPIED is set automatically by allocations.",
    pk: ["Room_ID", "Bed_No"],
    fields: [
      { name: "Room_ID", label: "Room", type: "ref", required: true, ref: { resource: "room" }, readOnlyOnEdit: true },
      { name: "Bed_Type", label: "Bed type", type: "select", required: true, options: BED_TYPES },
      { name: "Status", label: "Status", type: "select", required: true, options: BED_STATUS_EDITABLE, hint: "Occupied status is managed by allocations" },
    ],
    columns: [
      { key: "Property_Name", label: "Property" }, { key: "Room_No", label: "Room", sortable: true }, { key: "Bed_No", label: "Bed", kind: "number" },
      { key: "Bed_Type", label: "Type", kind: "badge" }, { key: "Status", label: "Status", kind: "badge", sortable: true }, { key: "Occupant", label: "Current resident" },
    ],
    filters: [{ name: "Property_ID", label: "Property", ref: "property" }, { name: "Status", label: "Status", options: ["AVAILABLE", "OCCUPIED", "MAINTENANCE"] }],
    perms: { read: OPS, create: OPS, update: OPS, delete: ADM },
  },
  room_asset: {
    key: "room_asset", title: "Room Assets", singular: "Room asset", icon: "plug", path: "/room-assets",
    description: "Which assets are assigned to which rooms.",
    pk: ["Assignment_No"],
    fields: [
      { name: "Room_ID", label: "Room", type: "ref", required: true, ref: { resource: "room" } },
      { name: "Asset_ID", label: "Asset", type: "ref", required: true, ref: { resource: "asset" } },
      { name: "Quantity", label: "Quantity", type: "number", required: true, min: 1 },
      { name: "Assigned_Date", label: "Assigned on", type: "date", required: true },
    ],
    columns: [
      { key: "Assignment_No", label: "No." }, { key: "Property_Name", label: "Property" }, { key: "Room_No", label: "Room", sortable: true },
      { key: "Asset_Name", label: "Asset" }, { key: "Quantity", label: "Qty", kind: "number" }, { key: "Assigned_Date", label: "Assigned", kind: "date" },
    ],
    filters: [{ name: "Room_ID", label: "Room", ref: "room" }],
    perms: { read: OPS, create: OPS, update: OPS, delete: OPS },
  },
  amenity: {
    key: "amenity", title: "Amenities", singular: "Amenity", icon: "sparkles", path: "/amenities",
    description: "Facilities that properties can provide (many-to-many).",
    pk: ["Amenity_ID"],
    fields: [
      { name: "Amenity_Name", label: "Amenity", type: "text", required: true, maxLength: 100 },
      { name: "Amenity_Type", label: "Category", type: "text", required: true, maxLength: 60, placeholder: "Utility / Service / Security" },
      { name: "Description", label: "Description", type: "textarea" },
    ],
    columns: [
      { key: "Amenity_ID", label: "ID" }, { key: "Amenity_Name", label: "Amenity", sortable: true }, { key: "Amenity_Type", label: "Category", kind: "badge" },
      { key: "Description", label: "Description" }, { key: "Property_Count", label: "Properties", kind: "number" },
    ],
    filters: [],
    perms: { read: OPS, create: ADM, update: ADM, delete: ADM },
  },
  resident: {
    key: "resident", title: "Residents", singular: "Resident", icon: "user", path: "/residents",
    description: "People staying at the PG. Age is derived from the date of birth.",
    pk: ["Resident_ID"],
    fields: [
      { name: "FirstName", label: "First name", type: "text", required: true, maxLength: 60 },
      { name: "LastName", label: "Last name", type: "text", required: true, maxLength: 60 },
      { name: "Email", label: "Email", type: "email", required: true, maxLength: 160 },
      { name: "phones", label: "Phone numbers", type: "tags", virtual: true, hint: "10-digit numbers, press Enter after each", placeholder: "9876543210" },
      { name: "Gender", label: "Gender", type: "select", required: true, options: GENDERS },
      { name: "DOB", label: "Date of birth", type: "date", required: true },
      { name: "Street", label: "Street", type: "text", required: true, maxLength: 160 },
      { name: "City", label: "City", type: "text", required: true, maxLength: 80 },
      { name: "Pincode", label: "Pincode", type: "text", required: true, ...PIN },
    ],
    columns: [
      { key: "Resident_ID", label: "ID" }, { key: "Full_Name", label: "Name", sortable: true }, { key: "Age", label: "Age", kind: "number" },
      { key: "Gender", label: "Gender", kind: "badge" }, { key: "Phones", label: "Phone" }, { key: "Email", label: "Email" },
      { key: "Property_Name", label: "Staying at" }, { key: "Room_No", label: "Room" },
    ],
    filters: [{ name: "Gender", label: "Gender", options: GENDERS }, { name: "City", label: "Home city" }],
    perms: { read: ALL, create: OPS, update: OPS, delete: ADM },
  },
  resident_document: {
    key: "resident_document", title: "Documents", singular: "Document", icon: "file", path: "/documents",
    description: "KYC documents submitted by residents and their verification status.",
    pk: ["Resident_ID", "DocNo"],
    fields: [
      { name: "Resident_ID", label: "Resident", type: "ref", required: true, ref: { resource: "resident" }, readOnlyOnEdit: true },
      { name: "Document_Type", label: "Document type", type: "select", required: true, options: DOC_TYPES },
      { name: "Document_Number", label: "Document number", type: "text", required: true, maxLength: 100 },
      { name: "Issue_Date", label: "Issue date", type: "date" },
      { name: "Verification_Status", label: "Verification", type: "select", required: true, options: DOC_STATUSES },
    ],
    columns: [
      { key: "Resident_Name", label: "Resident", sortable: true }, { key: "DocNo", label: "Doc #", kind: "number" }, { key: "Document_Type", label: "Type", kind: "badge" },
      { key: "Document_Number", label: "Number" }, { key: "Issue_Date", label: "Issued", kind: "date" }, { key: "Verification_Status", label: "Verification", kind: "badge", sortable: true },
    ],
    filters: [{ name: "Verification_Status", label: "Verification", options: DOC_STATUSES }, { name: "Document_Type", label: "Type", options: DOC_TYPES }],
    perms: { read: ALL, create: OPS, update: OPS, delete: ADM },
  },
  payment: {
    key: "payment", title: "Payments", singular: "Payment", icon: "wallet", path: "/payments",
    description: "Rent, deposits and other charges. For pending items the date is the due date.",
    pk: ["Payment_No"],
    fields: [
      { name: "Resident_ID", label: "Resident", type: "ref", required: true, ref: { resource: "resident" }, readOnlyOnEdit: true },
      { name: "Payment_Type", label: "Type", type: "select", required: true, options: PAYMENT_TYPES },
      { name: "Amount", label: "Amount (₹)", type: "money", required: true, min: 1 },
      { name: "Payment_Date", label: "Due / paid date", type: "date", required: true },
      { name: "Payment_Status", label: "Status", type: "select", required: true, options: PAYMENT_STATUSES },
    ],
    columns: [
      { key: "Payment_No", label: "Payment No." }, { key: "Resident_Name", label: "Resident", sortable: true }, { key: "Payment_Type", label: "Type", kind: "badge" },
      { key: "Amount", label: "Amount", kind: "money", sortable: true }, { key: "Payment_Date", label: "Date", kind: "date", sortable: true },
      { key: "Payment_Status", label: "Status", kind: "badge", sortable: true },
    ],
    filters: [{ name: "Payment_Status", label: "Status", options: PAYMENT_STATUSES }, { name: "Payment_Type", label: "Type", options: PAYMENT_TYPES }],
    perms: { read: ALL, create: OPS, update: OPS, delete: ADM },
  },
  food_item: {
    key: "food_item", title: "Food Items", singular: "Food item", icon: "utensils", path: "/food-items",
    description: "Catalogue of dishes that can be added to menus.",
    pk: ["Food_Item_ID"],
    fields: [
      { name: "Food_Name", label: "Name", type: "text", required: true, maxLength: 120 },
      { name: "Category", label: "Category", type: "select", required: true, options: FOOD_CATEGORIES },
      { name: "Unit", label: "Serving unit", type: "select", required: true, options: FOOD_UNITS },
    ],
    columns: [
      { key: "Food_Item_ID", label: "ID" }, { key: "Food_Name", label: "Name", sortable: true }, { key: "Category", label: "Category", kind: "badge" },
      { key: "Unit", label: "Unit" }, { key: "Used_In", label: "Used in menus", kind: "number" },
    ],
    filters: [{ name: "Category", label: "Category", options: FOOD_CATEGORIES }],
    perms: { read: ALL, create: OPS, update: OPS, delete: ADM },
  },
  menu: {
    key: "menu", title: "Menus", singular: "Menu", icon: "utensils", path: "/menus",
    description: "Meals served at a property on a date.",
    pk: ["Menu_ID"],
    fields: [
      { name: "Property_ID", label: "Property", type: "ref", required: true, ref: { resource: "property" } },
      { name: "Menu_Date", label: "Date", type: "date", required: true },
      { name: "Meal_Type", label: "Meal", type: "select", required: true, options: MEAL_TYPES },
      { name: "Meal_Time", label: "Serving time", type: "time", required: true },
    ],
    columns: [], filters: [],
    perms: { read: ALL, create: OPS, update: OPS, delete: OPS },
  },
  menu_item: {
    key: "menu_item", title: "Menu Items", singular: "Menu item", icon: "utensils", path: "/menus",
    description: "Dishes that make up a menu.",
    pk: ["Menu_ID", "Menu_Item_No"],
    fields: [
      { name: "Menu_ID", label: "Menu", type: "text", required: true, readOnlyOnEdit: true },
      { name: "Food_Item_ID", label: "Dish", type: "ref", required: true, ref: { resource: "food_item" } },
      { name: "Quantity", label: "Quantity per resident", type: "number", required: true, min: 0.5 },
    ],
    columns: [], filters: [],
    perms: { read: ALL, create: OPS, update: OPS, delete: OPS },
  },
};

export const can = (r: Resource, op: keyof Resource["perms"], role: Role) => r.perms[op].includes(role);
export const idOf = (r: Resource, row: any) => r.pk.map((k) => String(row[k])).join("~");
