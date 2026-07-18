// // prisma/seed.ts
// import { PrismaClient, DealStatus, DealStage, ActivityType, EntityType, UserRole, LeadStatus } from "@prisma/client";
// import bcrypt from "bcryptjs";

// const prisma = new PrismaClient();

// async function main() {
//   console.log("🌱 Seeding database...");

//   // ── Users ──────────────────────────────────────────────────────────────────
//   const hashedPassword = await bcrypt.hash("password123", 10);

//   const admin = await prisma.user.upsert({
//     where: { email: "admin@crm.com" },
//     update: {},
//     create: { name: "Sarah Ahmed", email: "admin@crm.com", password: hashedPassword, role: UserRole.ADMIN },
//   });

//   const rep1 = await prisma.user.upsert({
//     where: { email: "ali@crm.com" },
//     update: {},
//     create: { name: "Ali Hassan", email: "ali@crm.com", password: hashedPassword, role: UserRole.SALES_REP },
//   });

//   const rep2 = await prisma.user.upsert({
//     where: { email: "fatima@crm.com" },
//     update: {},
//     create: { name: "Fatima Khan", email: "fatima@crm.com", password: hashedPassword, role: UserRole.SALES_REP },
//   });

//   const rep3 = await prisma.user.upsert({
//     where: { email: "hamza@crm.com" },
//     update: {},
//     create: { name: "Hamza Iqbal", email: "hamza@crm.com", password: hashedPassword, role: UserRole.SALES_REP },
//   });

//   // Manager who owns the reporting hierarchy for rep1/rep2/rep3.
//   // Tasks module's /api/users/assignable and hierarchy checks depend on
//   // managerId being populated — without this, every "assign to my team"
//   // check would come back empty.
//   const manager = await prisma.user.upsert({
//     where: { email: "usman@crm.com" },
//     update: {},
//     create: { name: "Usman Tariq", email: "usman@crm.com", password: hashedPassword, role: UserRole.MANAGER },
//   });

//   await Promise.all([
//     prisma.user.update({ where: { id: rep1.id }, data: { managerId: manager.id } }),
//     prisma.user.update({ where: { id: rep2.id }, data: { managerId: manager.id } }),
//     prisma.user.update({ where: { id: rep3.id }, data: { managerId: manager.id } }),
//   ]);

//   const owners = [admin, rep1, rep2, rep3];
//   console.log("✅ Users created");

//   // ── Companies (10) ───────────────────────────────────────────────────────────
//   const companyData = [
//     { companyName: "TechCorp",       industry: "Software",     website: "techcorp.com" },
//     { companyName: "DesignCo",       industry: "Design",       website: "designco.com" },
//     { companyName: "FinTech IO",     industry: "Finance",      website: "fintech.io" },
//     { companyName: "HealthPlus",     industry: "Healthcare",   website: "healthplus.com" },
//     { companyName: "RetailMax",      industry: "Retail",       website: "retailmax.com" },
//     { companyName: "BuildRight",     industry: "Construction", website: "buildright.com" },
//     { companyName: "EduSpark",       industry: "Education",    website: "eduspark.com" },
//     { companyName: "GreenLeaf Foods",industry: "Food & Bev",   website: "greenleaffoods.com" },
//     { companyName: "Skyline Media",  industry: "Media",        website: "skylinemedia.com" },
//     { companyName: "Northwind Logistics", industry: "Logistics", website: "northwindlogistics.com" },
//   ];

//   const companies = await Promise.all(
//     companyData.map((c) => prisma.company.create({ data: c }))
//   );
//   console.log("✅ Companies created");

//   // ── Contacts (30) ──────────────────────────────────────────────────────────
//   const firstNames = ["John","Emily","Michael","Sara","David","Priya","Ahmed","Linda","Carlos","Nina",
//                        "Omar","Grace","Tom","Aisha","Kevin","Maria","Raj","Sophie","Daniel","Zainab",
//                        "Peter","Chloe","Yusuf","Hannah","Marcus","Fatima","Leo","Olivia","Samuel","Layla"];
//   const lastNames  = ["Smith","Johnson","Brown","Davis","Wilson","Sharma","Khan","Martinez","Garcia","Patel",
//                        "Farooq","Lee","Baker","Rahman","Clark","Lopez","Verma","Turner","Kim","Hussain",
//                        "Adams","Bennett","Malik","Foster","Reid","Ali","Nguyen","Bell","Price","Hassan"];
//   const locations  = ["Boston, MA","New York, NY","San Francisco, CA","Chicago, IL","Austin, TX",
//                        "Seattle, WA","Denver, CO","Miami, FL","Atlanta, GA","Portland, OR"];
//   const leadStatuses = [LeadStatus.HOT, LeadStatus.WARM, LeadStatus.COLD];

//   const contacts = [];
//   for (let i = 0; i < 30; i++) {
//     const company = companies[i % companies.length];
//     const owner = owners[i % owners.length];
//     const contact = await prisma.contact.upsert({
//       where: { email: `${firstNames[i].toLowerCase()}.${lastNames[i].toLowerCase()}@${company.website}` },
//       update: {},
//       create: {
//         firstName: firstNames[i],
//         lastName: lastNames[i],
//         email: `${firstNames[i].toLowerCase()}.${lastNames[i].toLowerCase()}@${company.website}`,
//         phone: `+1-555-${String(1000 + i).slice(-4)}`,
//         companyId: company.id,
//         location: locations[i % locations.length],
//         leadStatus: leadStatuses[i % leadStatuses.length],
//         isFavourite: i % 5 === 0, // every 5th contact favourited
//         ownerId: owner.id,
//       },
//     });
//     contacts.push(contact);
//   }
//   console.log(`✅ ${contacts.length} Contacts created`);

//   // ── Deals — 1 to 3 per contact, spread over last 6 months ───────────────────
//   const now = new Date();
//   const monthsAgo = (n: number) => { const d = new Date(now); d.setMonth(d.getMonth() - n); return d; };

//   const dealTitles = ["Enterprise License", "Annual Subscription", "Platform Deal", "Module Upgrade",
//                        "Integration Package", "Premium Tier", "Expansion Plan", "Full Suite", "Add-on Pack", "Renewal"];
//   const stages = [DealStage.QUALIFICATION, DealStage.PROPOSAL, DealStage.NEGOTIATION, DealStage.CLOSED_WON];
//   const statusCycle = [DealStatus.WON, DealStatus.WON, DealStatus.OPEN, DealStatus.OPEN, DealStatus.LOST];

//   const dealsData: any[] = [];
//   contacts.forEach((contact, i) => {
//     const dealsForThisContact = 1 + (i % 3); // 1–3 deals per contact
//     for (let j = 0; j < dealsForThisContact; j++) {
//       const status = statusCycle[(i + j) % statusCycle.length];
//       const stage = status === DealStatus.WON ? DealStage.CLOSED_WON : stages[(i + j) % stages.length];
//       const createdAt = monthsAgo((i + j) % 6);

//       // closedAt only ever gets set for WON deals — matches the live app's
//       // behavior, where the stage-update endpoint sets it automatically
//       // when a deal reaches Closed Won. LOST deals deliberately have no
//       // closedAt (no endpoint in the app marks a deal Lost yet — a standing
//       // gap, not an oversight here).
//       const closedAt =
//         status === DealStatus.WON
//           ? new Date(createdAt.getTime() + (7 + ((i + j) % 30)) * 24 * 60 * 60 * 1000) // 7–37 days later
//           : null;

//       dealsData.push({
//         title: `${dealTitles[(i + j) % dealTitles.length]}`,
//         contactId: contact.id,
//         ownerId: contact.ownerId,
//         amount: 8000 + ((i * 7 + j * 13) % 40) * 2500, // varied amounts, $8k–$100k+
//         stage,
//         status,
//         createdAt,
//         closedAt,
//         expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
//       });
//     }
//   });

//   const deals = await Promise.all(dealsData.map((d) => prisma.deal.create({ data: d })));
//   console.log(`✅ ${deals.length} Deals created`);

//   // ── Activities — sample of 15, referencing real deals/contacts ─────────────
//   const activityTemplates = [
//     (d: any, u: any) => ({ userId: u.id, activityType: ActivityType.DEAL_CREATED, entityType: EntityType.DEAL, entityId: d.id, message: `New deal created: ${d.title} — $${Number(d.amount).toLocaleString()}` }),
//     (d: any, u: any) => ({ userId: u.id, activityType: ActivityType.DEAL_UPDATED, entityType: EntityType.DEAL, entityId: d.id, message: `${d.title} updated to ${d.stage.replace("_", " ")}` }),
//     (d: any, u: any) => ({ userId: u.id, activityType: ActivityType.MEETING_SCHEDULED, entityType: EntityType.DEAL, entityId: d.id, message: `Meeting scheduled to discuss ${d.title}` }),
//   ];
//   const contactActivityTemplates = [
//     (c: any, u: any) => ({ userId: u.id, activityType: ActivityType.EMAIL_SENT, entityType: EntityType.CONTACT, entityId: c.id, message: `Follow-up email sent to ${c.firstName} ${c.lastName}` }),
//     (c: any, u: any) => ({ userId: u.id, activityType: ActivityType.CONTACT_UPDATED, entityType: EntityType.CONTACT, entityId: c.id, message: `Updated contact info for ${c.firstName} ${c.lastName}` }),
//   ];

//   const activityCreates: any[] = [];
//   for (let i = 0; i < 10; i++) {
//     const deal = deals[i * 3 % deals.length];
//     const user = owners.find((o) => o.id === deal.ownerId) ?? admin;
//     activityCreates.push(activityTemplates[i % activityTemplates.length](deal, user));
//   }
//   for (let i = 0; i < 8; i++) {
//     const contact = contacts[i * 3 % contacts.length];
//     const user = owners.find((o) => o.id === contact.ownerId) ?? admin;
//     activityCreates.push(contactActivityTemplates[i % contactActivityTemplates.length](contact, user));
//   }

//   await Promise.all(activityCreates.map((a) => prisma.activity.create({ data: a })));
//   console.log(`✅ ${activityCreates.length} Activities created`);

//   // ── Tasks ──────────────────────────────────────────────────────────────────
//   // createdBy is now a required field (Tasks & Activities module) — every
//   // task needs to know who created it, not just who it's assigned to.
//   await Promise.all([
//     prisma.task.create({ data: { title: "Follow up with TechCorp on renewal", assignedTo: rep1.id, createdBy: rep1.id, dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) } }),
//     prisma.task.create({ data: { title: "Prepare proposal for FinTech IO Expansion", assignedTo: rep2.id, createdBy: manager.id, dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) } }),
//     prisma.task.create({ data: { title: "Schedule demo for HealthPlus Full Suite", assignedTo: rep3.id, createdBy: manager.id, dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } }),
//     prisma.task.create({ data: { title: "Send contract to Skyline Media", assignedTo: rep1.id, createdBy: rep1.id, dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) } }),
//     prisma.task.create({ data: { title: "Check in with Northwind Logistics", assignedTo: rep2.id, createdBy: rep2.id, dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) } }),
//   ]);

//   // One sample MEETING-type task, with its TaskActivity detail row and a
//   // couple of attendees pulled from real seeded Contacts — exercises the
//   // full meeting flow (type, TaskActivity, TaskAttendee) end to end.
//   const meetingTask = await prisma.task.create({
//     data: {
//       title: "Kickoff call with FinTech IO",
//       assignedTo: rep2.id,
//       createdBy: manager.id,
//       type: "MEETING",
//       dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
//       activities: {
//         create: {
//           activityType: "MEETING",
//           meetingDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
//           meetingTime: "14:30",
//           location: "Zoom",
//           notes: "Discuss expansion scope and timeline",
//           createdBy: manager.id,
//         },
//       },
//     },
//   });

//   await prisma.taskAttendee.createMany({
//     data: [
//       { taskId: meetingTask.id, contactId: contacts[2].id }, // Michael Brown, FinTech IO
//     ],
//   });

//   console.log("✅ Tasks created");

//   console.log("\n🎉 Seeding complete!");
//   console.log(`   Companies:  ${companies.length}`);
//   console.log(`   Contacts:   ${contacts.length}`);
//   console.log(`   Deals:      ${deals.length}`);
//   console.log("\n📧 Login credentials:");
//   console.log("   Admin:    admin@crm.com  / password123");
//   console.log("   Manager:  usman@crm.com  / password123");
//   console.log("   Sales:    ali@crm.com    / password123");
//   console.log("   Sales:    fatima@crm.com / password123");
//   console.log("   Sales:    hamza@crm.com  / password123");
// }

// main()
//   .catch((e) => { console.error(e); process.exit(1); })
//   .finally(() => prisma.$disconnect());


// prisma/seed.ts
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Users ──────────────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@crm.com" },
    update: {},
    create: { name: "Sarah Ahmed", email: "admin@crm.com", password: hashedPassword, role: UserRole.ADMIN },
  });

  const rep1 = await prisma.user.upsert({
    where: { email: "ali@crm.com" },
    update: {},
    create: { name: "Ali Hassan", email: "ali@crm.com", password: hashedPassword, role: UserRole.SALES_REP },
  });

  const rep2 = await prisma.user.upsert({
    where: { email: "fatima@crm.com" },
    update: {},
    create: { name: "Fatima Khan", email: "fatima@crm.com", password: hashedPassword, role: UserRole.SALES_REP },
  });

  const rep3 = await prisma.user.upsert({
    where: { email: "hamza@crm.com" },
    update: {},
    create: { name: "Hamza Iqbal", email: "hamza@crm.com", password: hashedPassword, role: UserRole.SALES_REP },
  });

  // Manager who owns the reporting hierarchy for rep1/rep2/rep3.
  // Tasks module's /api/users/assignable and hierarchy checks depend on
  // managerId being populated — without this, every "assign to my team"
  // check would come back empty.
  const manager = await prisma.user.upsert({
    where: { email: "usman@crm.com" },
    update: {},
    create: { name: "Usman Tariq", email: "usman@crm.com", password: hashedPassword, role: UserRole.MANAGER },
  });

  await Promise.all([
    prisma.user.update({ where: { id: rep1.id }, data: { managerId: manager.id } }),
    prisma.user.update({ where: { id: rep2.id }, data: { managerId: manager.id } }),
    prisma.user.update({ where: { id: rep3.id }, data: { managerId: manager.id } }),
  ]);

  const users = [admin, manager, rep1, rep2, rep3];
  console.log("✅ Users created");

  console.log("\n🎉 Seeding complete!");
  console.log(`   Users:      ${users.length}`);
  console.log("\n📧 Login credentials:");
  console.log("   Admin:    admin@crm.com  / password123");
  console.log("   Manager:  usman@crm.com  / password123");
  console.log("   Sales:    ali@crm.com    / password123");
  console.log("   Sales:    fatima@crm.com / password123");
  console.log("   Sales:    hamza@crm.com  / password123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());