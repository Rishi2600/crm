// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";
// import { motion } from "framer-motion";
// import { Users, GitBranch, CheckSquare, BarChart3, ArrowRight, Check } from "lucide-react";
// import ThemeToggle from "@/components/layout/ThemeToggle";

// const FEATURES = [
//   {
//     icon: Users,
//     title: "Contacts",
//     desc: "Every lead and customer in one searchable place, with company and deal history attached.",
//   },
//   {
//     icon: GitBranch,
//     title: "Pipeline",
//     desc: "Drag deals through Qualification, Proposal, Negotiation, and Closed Won — see it move live.",
//   },
//   {
//     icon: CheckSquare,
//     title: "Tasks",
//     desc: "Assign work across your team's reporting hierarchy, with meeting scheduling built in.",
//   },
//   {
//     icon: BarChart3,
//     title: "Analytics",
//     desc: "Win rate, sales cycle, revenue trend, and top performers — computed fresh, every time.",
//   },
// ];

// const fadeUp = {
//   hidden: { opacity: 0, y: 16 },
//   visible: { opacity: 1, y: 0 },
// };

// export default function LandingPage() {
//   const router = useRouter();
//   const [isLoggedIn, setIsLoggedIn] = useState(false);

//   useEffect(() => {
//     setIsLoggedIn(!!localStorage.getItem("crm-token"));
//   }, []);

//   const primaryHref = isLoggedIn ? "/dashboard" : "/login";
//   const primaryLabel = isLoggedIn ? "Go to Dashboard" : "Sign In";

//   return (
//     <div style={{ background: "var(--bg)" }}>
//       {/* ── Nav ──────────────────────────────────────────────────────────── */}
//       <nav className="flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
//         <span className="text-lg font-semibold" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>CRM</span>
//         <div className="flex items-center gap-3">
//           <ThemeToggle />
//           <button
//             onClick={() => router.push(primaryHref)}
//             className="px-4 py-2 rounded-lg text-xs font-medium"
//             style={{ background: "var(--text)", color: "var(--bg)" }}
//           >
//             {primaryLabel}
//           </button>
//         </div>
//       </nav>

//       {/* ── Hero ─────────────────────────────────────────────────────────── */}
//       <section className="max-w-3xl mx-auto px-8 pt-16 pb-20 text-center">
//         <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.5 }}>
//           <div
//             className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs mb-6"
//             style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
//           >
//             <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--live)" }} />
//             Built for sales teams that move fast
//           </div>

//           <h1 className="text-5xl font-semibold leading-tight mb-5" style={{ color: "var(--text)", letterSpacing: "-0.03em" }}>
//             One workspace for<br />your entire pipeline.
//           </h1>
//           <p className="text-base mb-8 max-w-lg mx-auto" style={{ color: "var(--text-muted)" }}>
//             Contacts, deals, tasks, and reporting — without switching between five different tools to run your team.
//           </p>

//           <div className="flex items-center justify-center gap-3">
//             <button
//               onClick={() => router.push(primaryHref)}
//               className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium group"
//               style={{ background: "var(--text)", color: "var(--bg)" }}
//             >
//               {primaryLabel}
//               <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
//             </button>
//           </div>
//         </motion.div>

//         {/* Product preview mock — illustrative only, not live data */}
//         <motion.div
//           initial={{ opacity: 0, y: 24 }}
//           whileInView={{ opacity: 1, y: 0 }}
//           viewport={{ once: true }}
//           transition={{ duration: 0.5, delay: 0.1 }}
//           className="mt-16 p-4 rounded-2xl"
//           style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
//         >
//           <div className="grid grid-cols-4 gap-3 mb-3">
//             {[
//               { label: "Revenue", value: "$284.5K" },
//               { label: "Active Deals", value: "47" },
//               { label: "Contacts", value: "1,248" },
//               { label: "Win Rate", value: "28.4%" },
//             ].map((s) => (
//               <div key={s.label} className="p-3 rounded-xl text-left" style={{ background: "var(--bg-subtle)" }}>
//                 <div className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</div>
//                 <div className="text-lg font-semibold mt-0.5" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>{s.value}</div>
//               </div>
//             ))}
//           </div>
//           <div className="p-3 rounded-xl flex items-end gap-1.5 h-24" style={{ background: "var(--bg-subtle)" }}>
//             {[40, 65, 50, 80, 60, 95, 70].map((h, i) => (
//               <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: "var(--text)", opacity: 0.2 + (h / 100) * 0.7 }} />
//             ))}
//           </div>
//         </motion.div>
//       </section>

//       {/* ── Features ─────────────────────────────────────────────────────── */}
//       <section className="max-w-5xl mx-auto px-8 pb-24">
//         <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
//           {FEATURES.map((f, i) => (
//             <motion.div
//               key={f.title}
//               initial={{ opacity: 0, y: 16 }}
//               whileInView={{ opacity: 1, y: 0 }}
//               viewport={{ once: true }}
//               transition={{ duration: 0.4, delay: i * 0.08 }}
//               className="p-5 rounded-xl"
//               style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
//             >
//               <div
//                 className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
//                 style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
//               >
//                 <f.icon size={16} strokeWidth={1.8} style={{ color: "var(--text)" }} />
//               </div>
//               <h3 className="text-sm font-medium mb-1.5" style={{ color: "var(--text)" }}>{f.title}</h3>
//               <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{f.desc}</p>
//             </motion.div>
//           ))}
//         </div>
//       </section>

//       {/* ── Inverted CTA block — same trick as the login page's branded panel */}
//       <section
//         className="relative overflow-hidden py-20 px-8"
//         style={{ background: "var(--text)", color: "var(--bg)" }}
//       >
//         <div
//           className="absolute inset-0 opacity-[0.06]"
//           style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "24px 24px" }}
//         />
//         <motion.div
//           initial={{ opacity: 0, y: 16 }}
//           whileInView={{ opacity: 1, y: 0 }}
//           viewport={{ once: true }}
//           transition={{ duration: 0.5 }}
//           className="relative z-10 max-w-2xl mx-auto text-center"
//         >
//           <h2 className="text-3xl font-semibold mb-4" style={{ letterSpacing: "-0.02em" }}>
//             Ready to see your pipeline clearly?
//           </h2>
//           <div className="flex items-center justify-center gap-2 mb-8 text-sm opacity-80">
//             {["No setup fees", "Live in minutes", "Built for teams of any size"].map((t) => (
//               <span key={t} className="flex items-center gap-1.5">
//                 <Check size={13} strokeWidth={3} /> {t}
//               </span>
//             ))}
//           </div>
//           <button
//             onClick={() => router.push(primaryHref)}
//             className="px-5 py-2.5 rounded-lg text-sm font-medium"
//             style={{ background: "var(--bg)", color: "var(--text)" }}
//           >
//             {primaryLabel}
//           </button>
//         </motion.div>
//       </section>

//       {/* ── Footer ───────────────────────────────────────────────────────── */}
//       <footer className="px-8 py-8 text-center text-xs" style={{ color: "var(--text-faint)" }}>
//         © {new Date().getFullYear()} CRM. Built for sales teams that move fast.
//       </footer>
//     </div>
//   );
// }



"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Users, GitBranch, CheckSquare, BarChart3, ArrowRight, Check } from "lucide-react";
import ThemeToggle from "@/components/layout/ThemeToggle";

const FEATURES = [
  {
    icon: Users,
    title: "Contacts",
    desc: "Every lead and customer in one searchable place, with company and deal history attached.",
  },
  {
    icon: GitBranch,
    title: "Pipeline",
    desc: "Drag deals through Qualification, Proposal, Negotiation, and Closed Won — see it move live.",
  },
  {
    icon: CheckSquare,
    title: "Tasks",
    desc: "Assign work across your team's reporting hierarchy, with meeting scheduling built in.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    desc: "Win rate, sales cycle, revenue trend, and top performers — computed fresh, every time.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export default function LandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("crm-token"));
  }, []);

  const primaryHref = isLoggedIn ? "/dashboard" : "/login";
  const primaryLabel = isLoggedIn ? "Go to Dashboard" : "Sign In";

  return (
    <div style={{ background: "var(--bg)" }}>
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <span className="text-lg font-semibold" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>CRM</span>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => router.push(primaryHref)}
            className="px-4 py-2 rounded-lg text-xs font-medium"
            style={{ background: "var(--text)", color: "var(--bg)" }}
          >
            {primaryLabel}
          </button>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-8 pt-16 pb-20 text-center">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.5 }}>
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs mb-6"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--live)" }} />
            Built for sales teams that move fast
          </div>

          <h1 className="text-5xl font-semibold leading-tight mb-5" style={{ color: "var(--text)", letterSpacing: "-0.03em" }}>
            One workspace for<br />your entire pipeline.
          </h1>
          <p className="text-base mb-8 max-w-lg mx-auto" style={{ color: "var(--text-muted)" }}>
            Contacts, deals, tasks, and reporting — without switching between five different tools to run your team.
          </p>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => router.push(primaryHref)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium group"
              style={{ background: "var(--text)", color: "var(--bg)" }}
            >
              Enter Your Workspace
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </motion.div>

        {/* Product preview mock — illustrative only, not live data */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-16 p-4 rounded-2xl"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <div className="grid grid-cols-4 gap-3 mb-3">
            {[
              { label: "Revenue", value: "$284.5K" },
              { label: "Active Deals", value: "47" },
              { label: "Contacts", value: "1,248" },
              { label: "Win Rate", value: "28.4%" },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded-xl text-left" style={{ background: "var(--bg-subtle)" }}>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</div>
                <div className="text-lg font-semibold mt-0.5" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div className="p-3 rounded-xl flex items-end gap-1.5 h-24" style={{ background: "var(--bg-subtle)" }}>
            {[40, 65, 50, 80, 60, 95, 70].map((h, i) => (
              <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: "var(--text)", opacity: 0.2 + (h / 100) * 0.7 }} />
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-8 pb-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="p-5 rounded-xl"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
              >
                <f.icon size={16} strokeWidth={1.8} style={{ color: "var(--text)" }} />
              </div>
              <h3 className="text-sm font-medium mb-1.5" style={{ color: "var(--text)" }}>{f.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Inverted CTA block — same trick as the login page's branded panel */}
      <section
        className="relative overflow-hidden py-20 px-8"
        style={{ background: "var(--text)", color: "var(--bg)" }}
      >
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative z-10 max-w-2xl mx-auto text-center"
        >
          <h2 className="text-3xl font-semibold mb-4" style={{ letterSpacing: "-0.02em" }}>
            Ready to see your pipeline clearly?
          </h2>
          <div className="flex items-center justify-center gap-2 mb-8 text-sm opacity-80">
            {["No setup fees", "Live in minutes", "Built for teams of any size"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check size={13} strokeWidth={3} /> {t}
              </span>
            ))}
          </div>
          <button
            onClick={() => router.push(primaryHref)}
            className="px-5 py-2.5 rounded-lg text-sm font-medium"
            style={{ background: "var(--bg)", color: "var(--text)" }}
          >
            Jump In
          </button>
        </motion.div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="px-8 py-8 text-center text-xs" style={{ color: "var(--text-faint)" }}>
        © {new Date().getFullYear()} CRM. Built for sales teams that move fast.
      </footer>
    </div>
  );
}