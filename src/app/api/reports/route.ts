import { requireSession } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { query, mongo } from "@/lib/db";

// Analytical reports. Each block names the SQL / MongoDB concept it demonstrates (shown in the UI).
export const GET = handler(async () => {
  await requireSession(["ADMIN", "STAFF"]);

  const roomTypeRent = await query(`
    SELECT r.Room_Type, COUNT(*) AS Rooms, ROUND(AVG(r.Rent),0) AS Avg_Rent, MIN(r.Rent) AS Min_Rent, MAX(r.Rent) AS Max_Rent
      FROM ROOM r GROUP BY r.Room_Type ORDER BY Avg_Rent DESC`);

  const complaintsByCategory = await query(`
    SELECT Category, COUNT(*) AS Total,
           SUM(Status IN ('OPEN','IN_PROGRESS')) AS Open_Count,
           SUM(Priority IN ('HIGH','URGENT')) AS Urgent_Count
      FROM COMPLAINT GROUP BY Category HAVING COUNT(*) >= 1 ORDER BY Total DESC`);

  const duesAboveAverage = await query(`
    SELECT Resident_ID, Resident_Name, Total_Due FROM vw_resident_dues
     WHERE Total_Due > (SELECT AVG(Total_Due) FROM vw_resident_dues WHERE Total_Due > 0)
     ORDER BY Total_Due DESC`);

  const topPayers = await query(`
    SELECT Resident_Name, Paid_Amount, RANK() OVER (ORDER BY Paid_Amount DESC) AS Rank_No
      FROM vw_resident_dues WHERE Paid_Amount > 0 ORDER BY Rank_No, Resident_Name LIMIT 5`);

  const residentsByCity = await query(`
    SELECT City, COUNT(*) AS Residents FROM RESIDENT GROUP BY City HAVING COUNT(*) >= 1 ORDER BY Residents DESC, City LIMIT 6`);

  const staffPerProperty = await query(`
    SELECT p.Property_Name, COUNT(s.Staff_ID) AS Staff, COALESCE(SUM(s.Salary),0) AS Monthly_Payroll
      FROM PROPERTY p LEFT JOIN STAFF s ON s.Property_ID = p.Property_ID GROUP BY p.Property_ID, p.Property_Name ORDER BY Monthly_Payroll DESC`);

  const occupancy = await query("SELECT * FROM vw_property_occupancy ORDER BY Property_Name");

  // ---------------- MongoDB aggregations
  const db = await mongo();
  const ratingByMeal = await db.collection("meal_feedback").aggregate([
    { $group: { _id: { propertyId: "$propertyId", mealType: "$mealType" }, avgRating: { $avg: "$rating" }, reviews: { $sum: 1 } } },
    { $project: { _id: 0, propertyId: "$_id.propertyId", mealType: "$_id.mealType", avgRating: { $round: ["$avgRating", 2] }, reviews: 1 } },
    { $sort: { propertyId: 1, mealType: 1 } },
  ]).toArray();

  const topTags = await db.collection("meal_feedback").aggregate([
    { $unwind: "$tags" }, { $group: { _id: "$tags", count: { $sum: 1 }, avgRating: { $avg: "$rating" } } },
    { $project: { _id: 0, tag: "$_id", count: 1, avgRating: { $round: ["$avgRating", 1] } } },
    { $sort: { count: -1, tag: 1 } }, { $limit: 8 },
  ]).toArray();

  const activityByAction = await db.collection("audit_logs").aggregate([
    { $group: { _id: { role: "$actor.role", action: "$action" }, count: { $sum: 1 } } },
    { $project: { _id: 0, role: "$_id.role", action: "$_id.action", count: 1 } }, { $sort: { count: -1 } }, { $limit: 10 },
  ]).toArray();

  // cross-database: resolution time (MongoDB RESOLUTION events) joined with COMPLAINT.Date_Filed / Category (MySQL)
  const resolutions = await db.collection("complaint_updates").aggregate([
    { $match: { type: "RESOLUTION" } }, { $group: { _id: "$complaintNo", resolvedAt: { $min: "$createdAt" } } },
  ]).toArray();
  let resolutionByCategory: any[] = [];
  if (resolutions.length) {
    const rows = await query("SELECT Complaint_No, Category, Date_Filed FROM COMPLAINT WHERE Complaint_No IN (?)", [resolutions.map((r: any) => r._id)]);
    const acc: Record<string, { sum: number; n: number }> = {};
    for (const r of rows) {
      const at = resolutions.find((x: any) => x._id === r.Complaint_No)!.resolvedAt as Date;
      const days = Math.max(0, Math.round((at.getTime() - new Date(r.Date_Filed + "T00:00:00Z").getTime()) / 86400000));
      (acc[r.Category] ||= { sum: 0, n: 0 }); acc[r.Category].sum += days; acc[r.Category].n += 1;
    }
    resolutionByCategory = Object.entries(acc).map(([category, v]) => ({ category, avgDays: Math.round((v.sum / v.n) * 10) / 10, resolved: v.n })).sort((a, b) => b.avgDays - a.avgDays);
  }

  return ok({ roomTypeRent, complaintsByCategory, duesAboveAverage, topPayers, residentsByCity, staffPerProperty, occupancy,
              ratingByMeal, topTags, activityByAction, resolutionByCategory });
});
