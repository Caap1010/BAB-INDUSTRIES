// MASTER CAAP – Frontend Logic (no backend yet)
// Phases: "idea" -> "details" -> "final"
// Later you can swap mockAiResponse() with a real backend call.

const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const projectSpecEl = document.getElementById("project-spec");
const promptPills = document.querySelectorAll(".mc-prompt-pill");

let phase = "idea";
let projectIdea = "";
let projectDetails = "";

// ------------- Helpers -------------
function autoResizeTextarea() {
    userInput.style.height = "auto";
    userInput.style.height = userInput.scrollHeight + "px";
}

// Create message DOM
function addMessage(role, text, options = {}) {
    const msg = document.createElement("div");
    msg.className = `mc-message ${role === "user" ? "mc-user" : "mc-assistant"}`;

    const avatar = document.createElement("div");
    avatar.className = "mc-avatar";
    avatar.textContent = role === "user" ? "🧑" : "🤖";

    const bubble = document.createElement("div");
    bubble.className = "mc-bubble";

    const bubbleBody = document.createElement("div");
    bubbleBody.className = "mc-bubble-body";

    // Simple formatting: treat triple-backtick sections as code blocks visually
    const parts = text.split("```");
    parts.forEach((part, idx) => {
        if (idx % 2 === 1) {
            // code block
            const pre = document.createElement("pre");
            pre.className = "mc-code-block";
            const code = document.createElement("code");
            code.textContent = part.trim();
            pre.appendChild(code);
            bubbleBody.appendChild(pre);
        } else if (part.trim() !== "") {
            // normal text
            const span = document.createElement("span");
            span.textContent = part;
            bubbleBody.appendChild(span);
        }
    });

    if (role === "assistant") {
        const header = document.createElement("div");
        header.className = "mc-bubble-header";

        const roleLabel = document.createElement("span");
        roleLabel.className = "mc-bubble-role";
        roleLabel.textContent = "MASTER CAAP";

        const tag = document.createElement("span");
        tag.className = "mc-bubble-tag";
        tag.textContent = options.tag || "AI Architect";

        header.appendChild(roleLabel);
        header.appendChild(tag);
        bubble.appendChild(header);
    }

    bubble.appendChild(bubbleBody);
    msg.appendChild(avatar);
    msg.appendChild(bubble);
    chatContainer.appendChild(msg);

    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Update project spec panel
function updateProjectSpec() {
    if (!projectIdea) {
        projectSpecEl.textContent =
            "No project captured yet.\nStart by telling MASTER CAAP what you want to build.";
        projectSpecEl.classList.add("mc-spec-empty");
        return;
    }

    projectSpecEl.classList.remove("mc-spec-empty");
    projectSpecEl.textContent = [
        "🔹 Idea:",
        projectIdea,
        "",
        "🔹 Details / Answers:",
        projectDetails || "Waiting for your clarifications...",
        "",
        `🔹 Phase: ${phase === "idea"
            ? "Idea"
            : phase === "details"
                ? "Clarification"
                : "Ready for Code Outline"
        }`,
    ].join("\n");
}

// ------------- Mock AI Brain (local for now) -------------
function mockAiResponse(text) {
    if (phase === "idea") {
        projectIdea = text;
        phase = "details";
        updateProjectSpec();

        return `
Great concept 🔥

Before I generate a full project outline and code structure, I need to lock down a few technical details:

1️⃣ Frontend stack? (HTML/CSS/JS, React, Next.js, Flutter, etc.)  
2️⃣ Backend / API? (None, Node.js/Express, Supabase edge functions, etc.)  
3️⃣ Database? (Supabase, Firebase, Postgres, or none)  
4️⃣ Authentication? (No auth, email/password, social login, or magic links)  
5️⃣ Any must-have features? (dashboards, dark mode, payments, role-based access, etc.)

Answer in one message. I’ll then:
- Summarise the full BAB-style spec
- Suggest powerful enhancements
- Generate a structured code outline you can paste into VS Code.
`;
    }

    if (phase === "details") {
        projectDetails = text;
        phase = "final";
        updateProjectSpec();

        return `
Perfect. Here's your BAB-style project summary and upgrade plan 👇

🔷 Project Summary
- Idea: ${projectIdea}
- Technical details: ${projectDetails}

💡 Enhancement Suggestions (to make this "BAB Industries level")
- Add responsive layout with a clean developer dashboard shell
- Implement robust error + loading states for all async operations
- Design a reusable API / service layer so mobile apps can plug in later
- Add environment-based config (dev / staging / prod)
- Prepare basic logging for debugging and future observability

🧱 Recommended Folder Structure (high-level)

\`\`\`txt
project-root/
  ├─ public/
  ├─ src/
  │   ├─ components/
  │   ├─ pages/ or screens/
  │   ├─ lib/              # API clients, helpers
  │   ├─ hooks/
  │   └─ styles/
  ├─ tests/
  ├─ package.json
  └─ README.md
\`\`\`

From here, you can say:

"Generate full code outline"  
and I’ll produce a more detailed, file-by-file structure with starter code.
`;
    }

    // phase === "final"
    const lower = text.toLowerCase();

    // 🔥 NEW: actually generate a concrete code outline when user asks
    if (
        lower.includes("generate full code outline") ||
        lower.includes("code outline")
    ) {
        return `
Alright, let's generate a **concrete starter project** you can copy into VS Code.

I'll assume a **modern React + Vite + TypeScript** setup as an example.  
(We can later create versions for plain HTML, Next.js, Supabase, Node APIs, etc.)

📁 **Folder Structure**

\`\`\`txt
${"project-root/"}  
  ├─ public/
  │   └─ favicon.ico
  ├─ src/
  │   ├─ components/
  │   │   └─ Layout.tsx
  │   ├─ pages/
  │   │   └─ Home.tsx
  │   ├─ App.tsx
  │   ├─ main.tsx
  │   └─ styles/
  │       └─ globals.css
  ├─ index.html
  ├─ tsconfig.json
  ├─ vite.config.ts
  ├─ package.json
  └─ README.md
\`\`\`

📦 **package.json (starter)**

\`\`\`json
{
  "name": "master-caap-project",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
\`\`\`

🧠 **src/App.tsx**

\`\`\`tsx
import { Home } from "./pages/Home";

export function App() {
  return <Home />;
}
\`\`\`

🧠 **src/pages/Home.tsx**

\`\`\`tsx
import { Layout } from "../components/Layout";

export function Home() {
  return (
    <Layout title="BAB Industries • MASTER CAAP Starter">
      <section style={{ padding: "1.5rem 0" }}>
        <h1>Welcome to your MASTER CAAP generated project</h1>
        <p>
          This is a starter React + Vite + TypeScript setup based on your idea:
        </p>
        <pre
          style={{
            padding: "0.75rem 1rem",
            background: "#020617",
            borderRadius: "0.75rem",
            border: "1px solid #1e293b",
            marginTop: "0.75rem",
            whiteSpace: "pre-wrap",
          }}
        >
{${"`"}${projectIdea}${"`"}}
        </pre>
      </section>
    </Layout>
  );
}
\`\`\`

🧱 **src/components/Layout.tsx**

\`\`\`tsx
import { ReactNode } from "react";

interface LayoutProps {
  title: string;
  children: ReactNode;
}

export function Layout({ title, children }: LayoutProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #020617 0, #000 60%)",
        color: "#e5e7eb",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <header
        style={{
          padding: "0.9rem 1.4rem",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background:
            "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(15,23,42,0.92))",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.7rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#38bdf8",
            }}
          >
            BAB Industries • Tech Division
          </div>
          <div style={{ fontWeight: 700 }}>MASTER CAAP Starter</div>
        </div>
        <span
          style={{
            padding: "0.2rem 0.7rem",
            borderRadius: "999px",
            border: "1px solid rgba(148,163,184,0.7)",
            fontSize: "0.7rem",
          }}
        >
          {title}
        </span>
      </header>

      <main style={{ padding: "1.4rem 1.6rem" }}>{children}</main>

      <footer
        style={{
          padding: "0.7rem 1.4rem",
          borderTop: "1px solid #1e293b",
          fontSize: "0.75rem",
          color: "#64748b",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>Generated by MASTER CAAP</span>
        <span>BAB Industries</span>
      </footer>
    </div>
  );
}
\`\`\`

📘 **README snippet (what MASTER CAAP would tell you)**

\`\`\`md
# MASTER CAAP Starter

## Setup

1. Make sure you have Node.js and npm installed.
2. In your terminal:

   \`\`\`bash
   npm install
   npm run dev
   \`\`\`

3. Open the printed URL (usually \`http://localhost:5173\`) in your browser.

4. Open the project in VS Code and start building on top of this structure.
\`\`\`

You can now copy these snippets into a real project and build from here.  
Next step would be to choose a **database (e.g. Supabase)** and an **auth strategy**,  
and I can generate additional code for that as well.
`;
    }

    // Fallback explanation in final phase
    return `
You're now in the **Code Outline** phase ✅  

To see a concrete example, type:

"Generate full code outline"

and I'll respond with:
- Folder structure
- package.json
- Core React component files
- A README snippet

Later, when you connect MASTER CAAP to a real backend AI, these outlines
can be generated dynamically for any stack you choose.
`;
}

// ------------- Event Handlers -------------
function handleSend() {
    const text = userInput.value.trim();
    if (!text) return;

    addMessage("user", text);
    userInput.value = "";
    autoResizeTextarea();
    sendBtn.disabled = true;

    // Simulate thinking
    setTimeout(() => {
        const reply = mockAiResponse(text);
        addMessage("assistant", reply, { tag: "Spec & Architect Mode" });
        sendBtn.disabled = false;
        userInput.focus();
    }, 500);
}

sendBtn.addEventListener("click", handleSend);

userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
});

userInput.addEventListener("input", autoResizeTextarea);

// Quick prompt pills
promptPills.forEach((pill) => {
    pill.addEventListener("click", () => {
        const prompt = pill.getAttribute("data-prompt");
        if (!prompt) return;
        userInput.value = prompt;
        autoResizeTextarea();
        userInput.focus();
    });
});

// Initial resize
autoResizeTextarea();
updateProjectSpec();