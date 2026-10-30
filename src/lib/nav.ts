// Single source of truth for the sidebar. Every href MUST have a matching page in src/app/(app) (checked by tests/consistency.test.mjs).
import type { Role } from "./resources";
export interface NavItem { href: string; label: string; icon: string; roles: Role[]; labels?: Partial<Record<Role, string>> }
export interface NavSection { title: string; items: NavItem[] }

const ADM: Role[] = ["ADMIN"], OPS: Role[] = ["ADMIN", "STAFF"], ALL: Role[] = ["ADMIN", "STAFF", "RESIDENT"];

export const NAV: NavSection[] = [
  { title: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: "dashboard", roles: ALL, labels: { RESIDENT: "My Home" } }] },
  { title: "Property", items: [
    { href: "/properties", label: "Properties", icon: "building", roles: OPS },
    { href: "/rooms", label: "Rooms", icon: "door", roles: OPS },
    { href: "/beds", label: "Beds", icon: "bed", roles: OPS },
    { href: "/assets", label: "Assets", icon: "box", roles: OPS },
    { href: "/room-assets", label: "Room Assets", icon: "plug", roles: OPS },
    { href: "/amenities", label: "Amenities", icon: "sparkles", roles: OPS },
    { href: "/licenses", label: "Licences", icon: "badge", roles: OPS },
    { href: "/policies", label: "Policies", icon: "scroll", roles: OPS },
    { href: "/staff", label: "Staff", icon: "users", roles: OPS },
  ] },
  { title: "Residents", items: [
    { href: "/residents", label: "Residents", icon: "user", roles: ALL, labels: { RESIDENT: "My Profile" } },
    { href: "/allocations", label: "Allocations", icon: "key", roles: ALL, labels: { RESIDENT: "My Stay" } },
    { href: "/documents", label: "Documents", icon: "file", roles: ALL, labels: { RESIDENT: "My Documents" } },
  ] },
  { title: "Finance", items: [{ href: "/payments", label: "Payments", icon: "wallet", roles: ALL, labels: { RESIDENT: "My Payments" } }] },
  { title: "Services", items: [
    { href: "/complaints", label: "Complaints", icon: "complaint", roles: ALL, labels: { RESIDENT: "My Complaints" } },
    { href: "/visitors", label: "Visitors", icon: "visitor", roles: ALL },
    { href: "/menus", label: "Meal Menus", icon: "utensils", roles: ALL },
    { href: "/food-items", label: "Food Items", icon: "utensils", roles: OPS },
  ] },
  { title: "Insights", items: [
    { href: "/reports", label: "Reports", icon: "chart", roles: OPS },
    { href: "/audit", label: "Audit Log", icon: "shield", roles: ADM },
  ] },
];
