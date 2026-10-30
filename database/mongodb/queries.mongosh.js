// Demo MongoDB queries for the viva. Run in mongosh:  mongosh "<MONGODB_URI>/pg_management_nosql" database/mongodb/queries.mongosh.js
// (read-only)
print("== 1. Complaint timeline (index idx_complaint_timeline)");
printjson(db.complaint_updates.find({ complaintNo: "C001" }).sort({ createdAt: 1 }).toArray());

print("== 2. Aggregation: average rating per property and meal");
printjson(db.meal_feedback.aggregate([
  { $group: { _id: { propertyId: "$propertyId", mealType: "$mealType" }, avg: { $avg: "$rating" }, reviews: { $sum: 1 } } },
  { $sort: { avg: -1 } }]).toArray());

print("== 3. Aggregation: most common feedback tags ($unwind)");
printjson(db.meal_feedback.aggregate([{ $unwind: "$tags" }, { $group: { _id: "$tags", n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray());

print("== 4. Text search on complaint messages (text index)");
printjson(db.complaint_updates.find({ $text: { $search: "plumber tap" } }, { complaintNo: 1, message: 1 }).toArray());

print("== 5. Audit: actions per role");
printjson(db.audit_logs.aggregate([{ $group: { _id: { role: "$actor.role", action: "$action" }, n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray());

print("== 6. Users (hash only, never plain passwords)");
printjson(db.app_users.find({}, { username: 1, role: 1, residentId: 1, passwordHash: 1 }).toArray());

print("== 7. Indexes");
["app_users", "complaint_updates", "meal_feedback", "audit_logs"].forEach(c => printjson(db[c].getIndexes().map(i => i.name)));
