import { requireSession } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { query } from "@/lib/db";

// Dropdown data for the allocation form: residents without a bed, rooms with free beds, free beds of a room.
export const GET = handler(async (req: Request) => {
  await requireSession(["ADMIN", "STAFF"]);
  const room = new URL(req.url).searchParams.get("room");
  if (room) {
    const beds = await query("SELECT Bed_No, Bed_Type FROM BED WHERE Room_ID = ? AND Status = 'AVAILABLE' ORDER BY Bed_No", [room]);
    return ok({ beds });
  }
  const residents = await query(
    `SELECT r.Resident_ID AS value, CONCAT(r.FirstName, ' ', r.LastName, ' (', r.Resident_ID, ')') AS label
       FROM RESIDENT r
      WHERE NOT EXISTS (SELECT 1 FROM ALLOCATION a WHERE a.Resident_ID = r.Resident_ID AND a.Allocation_Status = 'ACTIVE')
      ORDER BY r.FirstName`);
  const rooms = await query(
    `SELECT Room_ID AS value, CONCAT(Property_Name, ' · Room ', Room_No, ' (', Room_Type, ') · ₹', Rent, ' · ', Available_Beds, ' free') AS label, Property_ID
       FROM vw_room_availability WHERE Available_Beds > 0 ORDER BY Property_Name, Room_No`);
  return ok({ residents, rooms });
});
