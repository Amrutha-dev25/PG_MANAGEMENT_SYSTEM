import { requireSession } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { query, mongo } from "@/lib/db";

export const GET = handler(async () => {
  const s = await requireSession();

  if (s.role === "RESIDENT") {
    const [profile] = await query("SELECT * FROM vw_resident_profile WHERE Resident_ID = ?", [s.residentId]);
    const [dues] = await query("SELECT * FROM vw_resident_dues WHERE Resident_ID = ?", [s.residentId]);
    const [alloc] = await query("SELECT * FROM vw_active_allocations WHERE Resident_ID = ?", [s.residentId]);
    const nextDue = await query("SELECT Payment_No, Payment_Type, Amount, Payment_Date FROM PAYMENT WHERE Resident_ID = ? AND Payment_Status = 'PENDING' ORDER BY Payment_Date LIMIT 3", [s.residentId]);
    const [{ open }] = await query("SELECT COUNT(*) AS open FROM COMPLAINT WHERE Resident_ID = ? AND Status IN ('OPEN','IN_PROGRESS')", [s.residentId]);
    return ok({ role: s.role, profile, dues, allocation: alloc ?? null, nextDue, openComplaints: open });
  }

  const [kpi] = await query(`
    SELECT (SELECT COUNT(*) FROM PROPERTY) AS Properties,
           (SELECT COUNT(*) FROM ALLOCATION WHERE Allocation_Status = 'ACTIVE') AS ActiveResidents,
           (SELECT COUNT(*) FROM BED WHERE Status = 'OCCUPIED') AS OccupiedBeds,
           (SELECT COUNT(*) FROM BED WHERE Status <> 'MAINTENANCE') AS UsableBeds,
           (SELECT COUNT(*) FROM BED WHERE Status = 'AVAILABLE') AS AvailableBeds,
           (SELECT COALESCE(SUM(Amount),0) FROM PAYMENT WHERE Payment_Status = 'PAID' AND DATE_FORMAT(Payment_Date,'%Y-%m') = DATE_FORMAT(CURDATE(),'%Y-%m')) AS CollectedThisMonth,
           (SELECT COALESCE(SUM(Amount),0) FROM PAYMENT WHERE Payment_Status = 'PENDING') AS PendingDues,
           (SELECT COALESCE(SUM(Amount),0) FROM PAYMENT WHERE Payment_Status = 'PENDING' AND Payment_Date < CURDATE()) AS OverdueDues,
           (SELECT COUNT(*) FROM COMPLAINT WHERE Status IN ('OPEN','IN_PROGRESS')) AS OpenComplaints,
           (SELECT COUNT(*) FROM VISITOR_LOG WHERE Out_Time IS NULL AND Visit_Date = CURDATE()) AS VisitorsInside`);
  const occupancy = await query("SELECT * FROM vw_property_occupancy ORDER BY Property_Name");
  const revenue = await query("SELECT * FROM (SELECT * FROM vw_monthly_revenue ORDER BY Month DESC LIMIT 6) x ORDER BY Month");
  const complaintsByPriority = await query("SELECT Priority, COUNT(*) AS n FROM COMPLAINT WHERE Status IN ('OPEN','IN_PROGRESS') GROUP BY Priority ORDER BY FIELD(Priority,'URGENT','HIGH','MEDIUM','LOW')");
  const licenseAlerts = await query("SELECT * FROM vw_license_alerts ORDER BY Days_Left");
  const topDues = await query("SELECT Resident_ID, Resident_Name, Total_Due, Overdue_Amount FROM vw_resident_dues WHERE Total_Due > 0 ORDER BY Total_Due DESC LIMIT 5");

  let recent: any[] = [];
  try {
    const db = await mongo();
    recent = (await db.collection("audit_logs").find({}).sort({ createdAt: -1 }).limit(8).toArray()).map((a: any) => ({ ...a, _id: String(a._id) }));
  } catch { /* optional */ }
  return ok({ role: s.role, kpi, occupancy, revenue, complaintsByPriority, licenseAlerts, topDues, recent });
});
