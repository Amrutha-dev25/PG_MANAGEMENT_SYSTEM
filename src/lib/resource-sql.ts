// SERVER-ONLY: SQL fragments for each managed resource (joins, search, filters, sorting, ID formats).
// All identifiers here are static constants - user input is only ever passed as bound parameters.
export interface Child { field: string; table: string; parentCol: string; valueCol: string; kind: "tags" | "multiref" }
export interface SqlCfg {
  table: string;
  select: string;
  from: string;
  search: string[];
  filters: Record<string, string>;
  sort: Record<string, string>;
  defaultSort: string;
  scope?: string;                       // column limiting rows for the RESIDENT role
  idPrefix?: { prefix: string; pad: number };   // auto-generated single-column primary key
  seq?: { col: string; parent: string[] };      // auto-numbered partial key of a weak entity
  children?: Child[];
  opt?: { value: string; label: string; from: string; filters: Record<string, string>; order: string };
}

const fullName = (a: string, f = "FirstName", l = "LastName") => `CONCAT(${a}.${f}, ' ', ${a}.${l})`;

export const SQL: Record<string, SqlCfg> = {
  property: {
    table: "PROPERTY",
    select: `t.*,
      (SELECT COUNT(*) FROM ROOM r WHERE r.Property_ID = t.Property_ID) AS Room_Count,
      (SELECT COUNT(*) FROM BED b JOIN ROOM r ON r.Room_ID = b.Room_ID WHERE r.Property_ID = t.Property_ID) AS Bed_Count,
      (SELECT GROUP_CONCAT(a.Amenity_Name ORDER BY a.Amenity_Name SEPARATOR ', ')
         FROM PROPERTY_AMENITY pa JOIN AMENITY a ON a.Amenity_ID = pa.Amenity_ID
        WHERE pa.Property_ID = t.Property_ID) AS Amenity_Names`,
    from: "PROPERTY t",
    search: ["t.Property_Name", "t.City", "t.Street", "t.Property_Type"],
    filters: { Property_Type: "t.Property_Type", City: "t.City" },
    sort: { Property_Name: "t.Property_Name", City: "t.City" },
    defaultSort: "t.Property_ID",
    idPrefix: { prefix: "P", pad: 3 },
    children: [{ field: "amenities", table: "PROPERTY_AMENITY", parentCol: "Property_ID", valueCol: "Amenity_ID", kind: "multiref" }],
    opt: { value: "t.Property_ID", label: "t.Property_Name", from: "PROPERTY t", filters: {}, order: "t.Property_Name" },
  },
  staff: {
    table: "STAFF",
    select: `t.*, CONCAT(t.First_Name, ' ', t.Last_Name) AS Full_Name, p.Property_Name,
             CONCAT(sv.First_Name, ' ', sv.Last_Name) AS Supervisor_Name`,
    from: "STAFF t JOIN PROPERTY p ON p.Property_ID = t.Property_ID LEFT JOIN STAFF sv ON sv.Staff_ID = t.Supervisor_ID",
    search: ["CONCAT(t.First_Name, ' ', t.Last_Name)", "t.Designation", "p.Property_Name"],
    filters: { Property_ID: "t.Property_ID" },
    sort: { Full_Name: "t.First_Name", Designation: "t.Designation", Join_Date: "t.Join_Date", Salary: "t.Salary" },
    defaultSort: "t.Property_ID, t.Staff_ID",
    idPrefix: { prefix: "S", pad: 3 },
    opt: { value: "t.Staff_ID", label: "CONCAT(t.First_Name, ' ', t.Last_Name, ' · ', t.Designation)", from: "STAFF t", filters: { Property_ID: "t.Property_ID" }, order: "t.First_Name" },
  },
  policy: {
    table: "POLICY",
    select: "t.*, p.Property_Name",
    from: "POLICY t JOIN PROPERTY p ON p.Property_ID = t.Property_ID",
    search: ["t.Policy_Type", "t.Description", "p.Property_Name"],
    filters: { Property_ID: "t.Property_ID" },
    sort: {}, defaultSort: "t.Property_ID, t.Policy_ID",
    idPrefix: { prefix: "POL", pad: 3 },
  },
  license: {
    table: "LICENSE",
    select: "t.*, p.Property_Name, DATEDIFF(t.Expiry_Date, CURDATE()) AS Days_Left",
    from: "LICENSE t JOIN PROPERTY p ON p.Property_ID = t.Property_ID",
    search: ["t.License_Type", "t.License_Number", "p.Property_Name"],
    filters: { Property_ID: "t.Property_ID" },
    sort: { License_Type: "t.License_Type", Expiry_Date: "t.Expiry_Date" }, defaultSort: "t.Expiry_Date",
    idPrefix: { prefix: "LIC", pad: 3 },
  },
  asset: {
    table: "ASSET",
    select: "t.*, p.Property_Name",
    from: "ASSET t JOIN PROPERTY p ON p.Property_ID = t.Property_ID",
    search: ["t.Asset_Name", "t.Asset_Type", "p.Property_Name"],
    filters: { Property_ID: "t.Property_ID", Condition: "t.`Condition`" },
    sort: { Asset_Name: "t.Asset_Name", Cost: "t.Cost" }, defaultSort: "t.Asset_ID",
    idPrefix: { prefix: "A", pad: 3 },
    opt: { value: "t.Asset_ID", label: "CONCAT(t.Asset_Name, ' · ', p.Property_Name)", from: "ASSET t JOIN PROPERTY p ON p.Property_ID = t.Property_ID", filters: { Property_ID: "t.Property_ID" }, order: "t.Asset_Name" },
  },
  room: {
    table: "ROOM",
    select: `t.*, p.Property_Name,
      (SELECT COUNT(*) FROM BED b WHERE b.Room_ID = t.Room_ID) AS Bed_Count,
      (SELECT COUNT(*) FROM BED b WHERE b.Room_ID = t.Room_ID AND b.Status = 'AVAILABLE') AS Available_Beds`,
    from: "ROOM t JOIN PROPERTY p ON p.Property_ID = t.Property_ID",
    search: ["t.Room_No", "t.Room_Type", "p.Property_Name"],
    filters: { Property_ID: "t.Property_ID", Room_Type: "t.Room_Type" },
    sort: { Room_No: "t.Room_No", Rent: "t.Rent" }, defaultSort: "t.Property_ID, t.Room_No",
    idPrefix: { prefix: "R", pad: 3 },
    opt: { value: "t.Room_ID", label: "CONCAT(p.Property_Name, ' · Room ', t.Room_No, ' (', t.Room_Type, ')')", from: "ROOM t JOIN PROPERTY p ON p.Property_ID = t.Property_ID", filters: { Property_ID: "t.Property_ID" }, order: "p.Property_Name, t.Room_No" },
  },
  bed: {
    table: "BED",
    select: "t.*, r.Room_No, r.Property_ID, p.Property_Name, va.Resident_Name AS Occupant",
    from: `BED t JOIN ROOM r ON r.Room_ID = t.Room_ID JOIN PROPERTY p ON p.Property_ID = r.Property_ID
           LEFT JOIN vw_active_allocations va ON va.Room_ID = t.Room_ID AND va.Bed_No = t.Bed_No`,
    search: ["r.Room_No", "p.Property_Name", "va.Resident_Name"],
    filters: { Property_ID: "r.Property_ID", Status: "t.Status", Room_ID: "t.Room_ID" },
    sort: { Room_No: "r.Room_No", Status: "t.Status" }, defaultSort: "p.Property_Name, r.Room_No, t.Bed_No",
    seq: { col: "Bed_No", parent: ["Room_ID"] },
  },
  room_asset: {
    table: "ROOM_ASSET",
    select: "t.*, a.Asset_Name, r.Room_No, p.Property_Name",
    from: "ROOM_ASSET t JOIN ASSET a ON a.Asset_ID = t.Asset_ID JOIN ROOM r ON r.Room_ID = t.Room_ID JOIN PROPERTY p ON p.Property_ID = r.Property_ID",
    search: ["a.Asset_Name", "r.Room_No", "p.Property_Name"],
    filters: { Room_ID: "t.Room_ID" },
    sort: { Room_No: "r.Room_No" }, defaultSort: "t.Assignment_No",
    idPrefix: { prefix: "RA", pad: 3 },
  },
  amenity: {
    table: "AMENITY",
    select: "t.*, (SELECT COUNT(*) FROM PROPERTY_AMENITY pa WHERE pa.Amenity_ID = t.Amenity_ID) AS Property_Count",
    from: "AMENITY t",
    search: ["t.Amenity_Name", "t.Amenity_Type", "t.Description"],
    filters: {}, sort: { Amenity_Name: "t.Amenity_Name" }, defaultSort: "t.Amenity_ID",
    idPrefix: { prefix: "AM", pad: 3 },
    opt: { value: "t.Amenity_ID", label: "t.Amenity_Name", from: "AMENITY t", filters: {}, order: "t.Amenity_Name" },
  },
  resident: {
    table: "RESIDENT",
    select: "t.*, v.Full_Name, v.Age, v.Phones, v.Property_Name, v.Room_No, v.Bed_No",
    from: "RESIDENT t LEFT JOIN vw_resident_profile v ON v.Resident_ID = t.Resident_ID",
    search: ["v.Full_Name", "t.Email", "v.Phones", "t.City", "t.Resident_ID"],
    filters: { Gender: "t.Gender", City: "t.City" },
    sort: { Full_Name: "t.FirstName" }, defaultSort: "t.Resident_ID",
    scope: "t.Resident_ID",
    idPrefix: { prefix: "RES", pad: 3 },
    children: [{ field: "phones", table: "RESIDENT_PHONE", parentCol: "Resident_ID", valueCol: "Phone_No", kind: "tags" }],
    opt: { value: "t.Resident_ID", label: `CONCAT(t.FirstName, ' ', t.LastName, ' (', t.Resident_ID, ')')`, from: "RESIDENT t", filters: {}, order: "t.FirstName" },
  },
  resident_document: {
    table: "RESIDENT_DOCUMENT",
    select: `t.*, ${fullName("r")} AS Resident_Name`,
    from: "RESIDENT_DOCUMENT t JOIN RESIDENT r ON r.Resident_ID = t.Resident_ID",
    search: [fullName("r"), "t.Document_Number", "t.Document_Type"],
    filters: { Verification_Status: "t.Verification_Status", Document_Type: "t.Document_Type" },
    sort: { Resident_Name: "r.FirstName", Verification_Status: "t.Verification_Status" }, defaultSort: "t.Resident_ID, t.DocNo",
    scope: "t.Resident_ID",
    seq: { col: "DocNo", parent: ["Resident_ID"] },
  },
  payment: {
    table: "PAYMENT",
    select: `t.*, ${fullName("r")} AS Resident_Name, (t.Payment_Status = 'PENDING' AND t.Payment_Date < CURDATE()) AS Is_Overdue`,
    from: "PAYMENT t JOIN RESIDENT r ON r.Resident_ID = t.Resident_ID",
    search: [fullName("r"), "t.Payment_No", "t.Payment_Type"],
    filters: { Payment_Status: "t.Payment_Status", Payment_Type: "t.Payment_Type", Resident_ID: "t.Resident_ID" },
    sort: { Resident_Name: "r.FirstName", Amount: "t.Amount", Payment_Date: "t.Payment_Date", Payment_Status: "t.Payment_Status" },
    defaultSort: "t.Payment_Date DESC, t.Payment_No",
    scope: "t.Resident_ID",
    idPrefix: { prefix: "PAY-", pad: 5 },
  },
  food_item: {
    table: "FOOD_ITEM",
    select: "t.*, (SELECT COUNT(*) FROM MENU_ITEM mi WHERE mi.Food_Item_ID = t.Food_Item_ID) AS Used_In",
    from: "FOOD_ITEM t",
    search: ["t.Food_Name", "t.Category"],
    filters: { Category: "t.Category" },
    sort: { Food_Name: "t.Food_Name" }, defaultSort: "t.Food_Item_ID",
    idPrefix: { prefix: "F", pad: 3 },
    opt: { value: "t.Food_Item_ID", label: "CONCAT(t.Food_Name, ' (', t.Unit, ')')", from: "FOOD_ITEM t", filters: {}, order: "t.Food_Name" },
  },
  menu: {
    table: "MENU",
    select: "t.*, p.Property_Name",
    from: "MENU t JOIN PROPERTY p ON p.Property_ID = t.Property_ID",
    search: ["p.Property_Name", "t.Meal_Type"],
    filters: { Property_ID: "t.Property_ID", Menu_Date: "t.Menu_Date" },
    sort: {}, defaultSort: "t.Menu_Date DESC, t.Meal_Time",
    idPrefix: { prefix: "M", pad: 3 },
  },
  menu_item: {
    table: "MENU_ITEM",
    select: "t.*, f.Food_Name, f.Unit",
    from: "MENU_ITEM t JOIN FOOD_ITEM f ON f.Food_Item_ID = t.Food_Item_ID",
    search: ["f.Food_Name"],
    filters: { Menu_ID: "t.Menu_ID" },
    sort: {}, defaultSort: "t.Menu_ID, t.Menu_Item_No",
    seq: { col: "Menu_Item_No", parent: ["Menu_ID"] },
  },
};
