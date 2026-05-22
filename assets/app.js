import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const tackyBot = Object.freeze({
  name: "Tacky",
  clientId: "1507476688228061304"
});
const defaultGuildId = "";
const defaultConfig = {
  guildId: defaultGuildId,
  ownerRoleId: "",
  memberRoleId: "",
  ticketBotRoleId: "",
  ticketPanelChannelId: "",
  ticketCategoryId: "",
  commissionPanelChannelId: "",
  commissionCategoryId: "",
  commissionReviewChannelId: "",
  commissionCompletedLogChannelId: "",
  moderationLogChannelId: "",
  verifyChannelId: "",
  accentColor: 3339371,
  dangerColor: 15680580,
  ticketPanel: {
    title: "Support Ticket Panel",
    message: "Need help or want to contact us? Please choose the option that best fits your request from the dropdown below.\n\nGeneral Questions\nAsk about services, pricing, timelines, commissions, project details, or anything else you need help with.\n\nPartnership\nApply for a partnership with Clovic Development or discuss possible collaboration opportunities.\n\nBug Fixes\nReport something that is broken, not working correctly, giving errors, or needs troubleshooting.\n\nOther Fixes\nRequest small changes, setup help, configuration fixes, updates, or support that is not considered a bug.\n\nPlease choose the correct option and provide as much detail as possible so I can help you faster.",
    placeholder: "Choose the type of ticket you need",
    types: [
      { label: "General Questions", value: "general_questions", description: "Services, pricing, timelines, commissions, and project details.", channelPrefix: "gq", displayPrefix: "GQ", emoji: "❔" },
      { label: "Partnership", value: "partnership", description: "Apply for partnership or discuss collaboration.", channelPrefix: "partner", displayPrefix: "Partner", emoji: "🤝" },
      { label: "Bug Fixes", value: "bug_fixes", description: "Report broken features, errors, or troubleshooting needs.", channelPrefix: "bug-fix", displayPrefix: "Bug Fix", emoji: "🛠️" },
      { label: "Other Fixes", value: "other_fixes", description: "Small changes, setup help, updates, and configuration fixes.", channelPrefix: "other-fix", displayPrefix: "Other Fix", emoji: "🔧" }
    ]
  },
  commissionPanel: {
    title: "Commission Panel",
    message: "Press the green button to create a commission request. You will fill out the service, size, budget, deadline, description, features, references, needed files, technical details, and payment method.",
    buttonLabel: "Create Commission",
    reviewTitle: "New Commission Submitted"
  },
  verification: {
    title: "Verify to Enter",
    message: "Press the button or react with the emoji below to receive the member role.",
    emoji: "✅",
    buttonLabel: "Verify",
    webhookName: "Clovic Verification",
    webhookAvatarUrl: ""
  },
  commands: {
    defaultEphemeral: true,
    disabledMessage: "That command is disabled from the dashboard.",
    fallbackTitle: "Action Ready",
    fallbackMessage: "This command is connected to the dashboard. Edit its response, permissions, and enabled state from the Commands tab."
  }
};

const state = {
  supabase: null,
  session: null,
  tab: localStorage.getItem("tacky.tab") || "overview",
  guildId: localStorage.getItem("tacky.guildId") || defaultGuildId,
  config: null,
  status: null,
  tickets: [],
  commissions: [],
  commands: [],
  tasks: [],
  logs: [],
  members: [],
  selectedCommandId: null,
  commandSearch: "",
  loading: false
};

const navItems = [
  ["overview", "LayoutDashboard", "Overview"],
  ["config", "SlidersHorizontal", "Roles & Channels"],
  ["panels", "PanelTop", "Panels"],
  ["commands", "TerminalSquare", "Commands"],
  ["tickets", "Ticket", "Tickets"],
  ["commissions", "BadgeDollarSign", "Commissions"],
  ["admins", "UsersRound", "Admins"],
  ["bots", "Bot", "Tacky Bot"],
  ["setup", "BookOpen", "Setup"]
];

const app = document.querySelector("#app");

function html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function attr(value) {
  return html(value).replaceAll("\n", "&#10;");
}

function deepMerge(base, override) {
  const output = structuredClone(base);
  for (const [key, value] of Object.entries(override || {})) {
    if (value && typeof value === "object" && !Array.isArray(value) && output[key] && typeof output[key] === "object" && !Array.isArray(output[key])) {
      output[key] = deepMerge(output[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function normalizeBrand(value) {
  const oldBrand = ["Clovi", "x"].join("");
  if (typeof value === "string") return value.replaceAll(oldBrand, "Clovic").replaceAll(oldBrand.toLowerCase(), "clovic");
  if (Array.isArray(value)) return value.map((item) => normalizeBrand(item));
  if (value && typeof value === "object") {
    const output = {};
    for (const [key, item] of Object.entries(value)) output[key] = normalizeBrand(item);
    return output;
  }
  return value;
}

function isTackyOnline() {
  const status = state.status;
  const stale = status?.last_seen_at ? Date.now() - new Date(status.last_seen_at).getTime() > 120000 : true;
  return Boolean(status?.is_in_guild) && !stale && String(status?.bot_client_id || "") === tackyBot.clientId;
}

function lockedMessage() {
  const status = state.status;
  if (status?.bot_client_id && String(status.bot_client_id) !== tackyBot.clientId) {
    return "This dashboard only works with Tacky Bot. The bot connected to this server is not Tacky.";
  }
  if (status?.is_in_guild === true && !status?.last_seen_at) {
    return "Tacky Bot is added to this server, but it has not reported online status yet.";
  }
  if (status?.is_in_guild && status?.last_seen_at && Date.now() - new Date(status.last_seen_at).getTime() > 120000) {
    return "Tacky Bot has not checked in recently. Start the bot, then refresh this dashboard.";
  }
  if (status?.is_in_guild === false) {
    return "Tacky Bot is not added to this Discord server. Dashboard controls are locked.";
  }
  return "Tacky Bot status has not been confirmed for this Discord server yet. Start the bot, then refresh this dashboard.";
}

function lockedHelp() {
  const status = state.status;
  if (status?.is_in_guild === false) return "Invite Tacky Bot to the server, start the bot host, then refresh this dashboard.";
  if (status?.bot_client_id && String(status.bot_client_id) !== tackyBot.clientId) return "Use the Tacky Bot application for this dashboard.";
  return "Start or restart Tacky Bot so it can update Supabase, then refresh this dashboard.";
}

function requireTackyOnline() {
  if (!isTackyOnline()) throw new Error(lockedMessage());
}

function supabaseSettings() {
  return {
    url: localStorage.getItem("tacky.supabaseUrl") || "",
    anon: localStorage.getItem("tacky.supabaseAnon") || ""
  };
}

function createSupabase() {
  const settings = supabaseSettings();
  if (!settings.url || !settings.anon) return null;
  return createClient(settings.url, settings.anon);
}

function icon(name) {
  return `<i data-lucide="${name}"></i>`;
}

function paint() {
  const activeId = document.activeElement?.id;
  if (!state.supabase) {
    renderSupabaseSetup();
  } else if (!state.session) {
    renderAuth();
  } else {
    renderApp();
  }
  if (window.lucide) window.lucide.createIcons({ attrs: { width: 17, height: 17 } });
  if (activeId === "command-search") {
    const input = document.querySelector("#command-search");
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  }
}

function toast(message) {
  const item = document.createElement("div");
  item.className = "toast";
  item.textContent = message;
  document.body.append(item);
  setTimeout(() => item.remove(), 2600);
}

function renderSupabaseSetup() {
  const settings = supabaseSettings();
  app.innerHTML = `
    <main class="auth-shell">
      <section class="auth-card">
        <div class="brand-pane">
          <img src="assets/clovic-logo.png" alt="Clovic logo">
          <h1>Tacky Dashboard</h1>
          <p>Connect this static dashboard to your Supabase project. The URL and anon key are safe to use in GitHub Pages when row level security is enabled.</p>
        </div>
        <form class="auth-form" id="supabase-form">
          <h2>Supabase Connection</h2>
          <div class="field">
            <label>Supabase Project URL</label>
            <input name="url" value="${attr(settings.url)}" placeholder="https://your-project.supabase.co" required>
          </div>
          <div class="field">
            <label>Supabase Anon Public Key</label>
            <textarea name="anon" required placeholder="eyJ...">${html(settings.anon)}</textarea>
          </div>
          <button class="btn primary" type="submit">${icon("PlugZap")} Connect Dashboard</button>
        </form>
      </section>
    </main>`;
}

function renderAuth() {
  app.innerHTML = `
    <main class="auth-shell">
      <section class="auth-card">
        <div class="brand-pane">
          <img src="assets/clovic-logo.png" alt="Clovic logo">
          <h1>Tacky Dashboard</h1>
          <p>Log in with the email and password account you created in Supabase Auth. Give this link to a friend only after adding their email in the Admins tab.</p>
        </div>
        <form class="auth-form" id="auth-form">
          <h2>Dashboard Login</h2>
          <div class="field">
            <label>Email</label>
            <input name="email" type="email" autocomplete="email" required>
          </div>
          <div class="field">
            <label>Password</label>
            <input name="password" type="password" autocomplete="current-password" required>
          </div>
          <div class="actions">
            <button class="btn primary" type="submit" data-auth="signin">${icon("LogIn")} Sign In</button>
            <button class="btn" type="button" id="change-supabase">${icon("Settings")} Supabase</button>
          </div>
        </form>
      </section>
    </main>`;
}

function renderApp() {
  const status = state.status;
  const botOk = isTackyOnline();
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="logo-row">
          <img src="assets/clovic-logo.png" alt="Clovic logo">
          <div><strong>Tacky</strong><span>Clovic Control</span></div>
        </div>
        <nav class="nav">
          ${navItems.map(([id, iconName, label]) => `<button class="${state.tab === id ? "active" : ""}" data-tab="${id}">${icon(iconName)} ${label}</button>`).join("")}
        </nav>
      </aside>
      <main class="main">
        <div class="topbar">
          <form class="guild-bar" id="guild-form">
            <input name="guildId" value="${attr(state.guildId)}" placeholder="Discord server ID" required>
            <button class="btn" type="submit">${icon("Search")} Open Server</button>
            <button class="btn" type="button" id="refresh">${icon("RefreshCw")} Refresh</button>
          </form>
          <div class="user-actions">
            <span class="tiny">${html(state.session.user.email)}</span>
            <button class="icon-btn" id="logout" title="Sign out">${icon("LogOut")}</button>
          </div>
        </div>
        ${botOk ? `<div class="alert ok">Tacky Bot is online in ${html(status.guild_name || "this server")} and checked in ${new Date(status.last_seen_at).toLocaleString()}.</div>` : `<div class="alert danger">${html(lockedMessage())}</div>`}
        ${state.loading ? `<div class="alert">Loading server data...</div>` : renderTab()}
      </main>
    </div>`;
}

function renderTab() {
  if (!isTackyOnline() && !["overview", "bots", "setup"].includes(state.tab)) return renderLocked();
  if (state.tab === "overview") return renderOverview();
  if (state.tab === "config") return renderConfig();
  if (state.tab === "panels") return renderPanels();
  if (state.tab === "commands") return renderCommands();
  if (state.tab === "tickets") return renderTickets();
  if (state.tab === "commissions") return renderCommissions();
  if (state.tab === "admins") return renderAdmins();
  if (state.tab === "bots") return renderBots();
  return renderSetup();
}

function renderLocked() {
  return `
    <section class="panel">
      <h2>Locked</h2>
      <p>${html(lockedMessage())}</p>
      <p>${html(lockedHelp())}</p>
    </section>`;
}

function renderOverview() {
  const config = state.config || defaultConfig;
  const locked = !isTackyOnline() ? "disabled" : "";
  return `
    <section class="grid">
      ${stat("Guild ID", state.guildId, "Server being edited")}
      ${stat("Bot Status", isTackyOnline() ? "Tacky Online" : "Locked", "Live Discord presence")}
      ${stat("Tickets", state.tickets.length, "Tracked tickets")}
      ${stat("Commands", state.commands.length, "Dashboard command actions")}
      <div class="panel span-8">
        <h2>Quick Publish</h2>
        <p>These buttons queue work for the bot. GitHub Pages never touches your bot token.</p>
        <div class="actions">
          <button class="btn primary" data-panel="ticket" ${locked}>${icon("Ticket")} Send Ticket Panel</button>
          <button class="btn primary" data-panel="commission" ${locked}>${icon("BadgeDollarSign")} Send Commission Panel</button>
          <button class="btn primary" data-panel="verification" ${locked}>${icon("ShieldCheck")} Send Verification Panel</button>
        </div>
      </div>
      <div class="panel span-4">
        <h2>Important IDs</h2>
        <p>Ticket panel: ${html(config.ticketPanelChannelId)}</p>
        <p>Commission review: ${html(config.commissionReviewChannelId)}</p>
        <p>Verify channel: ${html(config.verifyChannelId)}</p>
      </div>
      <div class="panel span-12">
        <h2>Recent Dashboard Tasks</h2>
        ${taskTable(state.tasks.slice(0, 8))}
      </div>
    </section>`;
}

function stat(title, value, subtext) {
  return `<div class="panel span-3 stat"><span>${html(subtext)}</span><strong>${html(value)}</strong><span>${html(title)}</span></div>`.replace("span-3", "span-4");
}

function renderConfig() {
  const c = state.config || defaultConfig;
  return `
    <form class="grid" id="config-form">
      <div class="panel span-6">
        <h2>Roles</h2>
        <div class="form-grid">
          ${field("Owner Role", "ownerRoleId", c.ownerRoleId)}
          ${field("Member Role", "memberRoleId", c.memberRoleId)}
          ${field("Ticket Bot Role", "ticketBotRoleId", c.ticketBotRoleId)}
          ${field("Verify Role Override", "verification.roleId", c.verification?.roleId || "")}
        </div>
      </div>
      <div class="panel span-6">
        <h2>Channels & Categories</h2>
        <div class="form-grid">
          ${field("Ticket Panel Channel", "ticketPanelChannelId", c.ticketPanelChannelId)}
          ${field("Ticket Category", "ticketCategoryId", c.ticketCategoryId)}
          ${field("Commission Panel Channel", "commissionPanelChannelId", c.commissionPanelChannelId)}
          ${field("Commission Category", "commissionCategoryId", c.commissionCategoryId)}
          ${field("Commission Review Channel", "commissionReviewChannelId", c.commissionReviewChannelId)}
          ${field("Completed Commission Logs", "commissionCompletedLogChannelId", c.commissionCompletedLogChannelId)}
          ${field("Moderation Logs", "moderationLogChannelId", c.moderationLogChannelId)}
          ${field("Verify Channel", "verifyChannelId", c.verifyChannelId)}
        </div>
      </div>
      <div class="panel span-12">
        <h2>Command Defaults</h2>
        <div class="form-grid">
          ${field("Disabled Message", "commands.disabledMessage", c.commands.disabledMessage, "textarea")}
          ${field("Fallback Title", "commands.fallbackTitle", c.commands.fallbackTitle)}
          ${field("Fallback Message", "commands.fallbackMessage", c.commands.fallbackMessage, "textarea")}
          <div class="field">
            <label>Default Visibility</label>
            <select name="commands.defaultEphemeral">
              <option value="true" ${c.commands.defaultEphemeral ? "selected" : ""}>Private</option>
              <option value="false" ${!c.commands.defaultEphemeral ? "selected" : ""}>Public</option>
            </select>
          </div>
        </div>
        <div class="actions"><button class="btn primary" type="submit">${icon("Save")} Save Configuration</button></div>
      </div>
    </form>`;
}

function renderPanels() {
  const c = state.config || defaultConfig;
  return `
    <section class="grid">
      <form class="panel span-6" id="ticket-panel-form">
        <h2>Ticket Panel</h2>
        <div class="form-grid">
          ${field("Title", "ticketPanel.title", c.ticketPanel.title)}
          ${field("Dropdown Placeholder", "ticketPanel.placeholder", c.ticketPanel.placeholder)}
          ${field("Message", "ticketPanel.message", c.ticketPanel.message, "textarea full")}
        </div>
        <h3>Dropdown Options</h3>
        <div class="form-grid">
          ${c.ticketPanel.types.map((type, index) => ticketTypeFields(type, index)).join("")}
        </div>
        <div class="actions">
          <button class="btn primary" type="submit">${icon("Save")} Save Ticket Panel</button>
          <button class="btn" type="button" data-panel="ticket">${icon("Send")} Publish Ticket Panel</button>
        </div>
      </form>
      <div class="panel span-6">
        <h2>Ticket Preview</h2>
        <div class="preview">🎫 ${html(c.ticketPanel.title)}\n${html(c.ticketPanel.message)}</div>
      </div>
      <form class="panel span-6" id="commission-panel-form">
        <h2>Commission Panel</h2>
        <div class="form-grid">
          ${field("Title", "commissionPanel.title", c.commissionPanel.title)}
          ${field("Button Label", "commissionPanel.buttonLabel", c.commissionPanel.buttonLabel)}
          ${field("Review Embed Title", "commissionPanel.reviewTitle", c.commissionPanel.reviewTitle)}
          ${field("Message", "commissionPanel.message", c.commissionPanel.message, "textarea full")}
        </div>
        <div class="actions">
          <button class="btn primary" type="submit">${icon("Save")} Save Commission Panel</button>
          <button class="btn" type="button" data-panel="commission">${icon("Send")} Publish Commission Panel</button>
        </div>
      </form>
      <form class="panel span-6" id="verification-panel-form">
        <h2>Verification Panel</h2>
        <div class="form-grid">
          ${field("Title", "verification.title", c.verification.title)}
          ${field("Emoji", "verification.emoji", c.verification.emoji)}
          ${field("Button Label", "verification.buttonLabel", c.verification.buttonLabel)}
          ${field("Webhook Name", "verification.webhookName", c.verification.webhookName)}
          ${field("Webhook Avatar URL", "verification.webhookAvatarUrl", c.verification.webhookAvatarUrl)}
          ${field("Message", "verification.message", c.verification.message, "textarea full")}
        </div>
        <div class="actions">
          <button class="btn primary" type="submit">${icon("Save")} Save Verification Panel</button>
          <button class="btn" type="button" data-panel="verification">${icon("Send")} Publish Verification Panel</button>
        </div>
      </form>
    </section>`;
}

function renderCommands() {
  const filtered = state.commands.filter((item) => `${item.family} ${item.action} ${item.label}`.toLowerCase().includes(state.commandSearch.toLowerCase()));
  const selected = state.commands.find((item) => item.id === state.selectedCommandId) || filtered[0];
  if (selected && !state.selectedCommandId) state.selectedCommandId = selected.id;
  return `
    <section class="grid">
      <div class="panel span-4 command-list">
        <h2>Command Actions</h2>
        <input id="command-search" value="${attr(state.commandSearch)}" placeholder="Search ${state.commands.length} actions">
        <div class="actions"><span class="pill">${filtered.length} shown</span></div>
        <div class="nav">
          ${filtered.slice(0, 80).map((item) => `<button class="${selected?.id === item.id ? "active" : ""}" data-command-id="${item.id}">${item.enabled ? icon("CircleCheck") : icon("CircleOff")} ${html(item.label)}</button>`).join("") || `<div class="empty">No commands found.</div>`}
        </div>
      </div>
      <div class="panel span-8">
        ${selected ? commandEditor(selected) : `<h2>No Command Selected</h2><p>Start the bot once to seed command actions into Supabase.</p>`}
      </div>
    </section>`;
}

function commandEditor(item) {
  return `
    <form id="command-form">
      <h2>${html(item.label)}</h2>
      <p>${html(item.action_key)}</p>
      <input type="hidden" name="id" value="${attr(item.id)}">
      <div class="form-grid">
        ${field("Label", "label", item.label)}
        ${field("Required Role ID", "required_role_id", item.required_role_id || "")}
        <div class="field">
          <label>Enabled</label>
          <select name="enabled">
            <option value="true" ${item.enabled ? "selected" : ""}>Enabled</option>
            <option value="false" ${!item.enabled ? "selected" : ""}>Disabled</option>
          </select>
        </div>
        <div class="field">
          <label>Visibility</label>
          <select name="ephemeral">
            <option value="true" ${item.ephemeral ? "selected" : ""}>Private Reply</option>
            <option value="false" ${!item.ephemeral ? "selected" : ""}>Public Reply</option>
          </select>
        </div>
        ${field("Response Title", "response_title", item.response_title || "")}
        ${field("Response Body", "response_body", item.response_body || "", "textarea full")}
      </div>
      <div class="actions"><button class="btn primary" type="submit">${icon("Save")} Save Command</button></div>
    </form>`;
}

function renderTickets() {
  return `
    <section class="panel">
      <h2>Tickets</h2>
      ${table(["Title", "Type", "Owner", "Status", "Created"], state.tickets.map((ticket) => [
        ticket.title || ticket.channel_id,
        ticket.type,
        ticket.owner_id,
        pill(ticket.status, ticket.status === "open"),
        new Date(ticket.created_at).toLocaleString()
      ]))}
    </section>`;
}

function renderCommissions() {
  return `
    <section class="panel">
      <h2>Commissions</h2>
      ${table(["Service", "Budget", "User", "Status", "Created"], state.commissions.map((item) => [
        item.answers?.service || "Unknown",
        item.answers?.budget || "Unknown",
        item.user_id,
        pill(item.status, item.status === "submitted" || item.status === "quoted"),
        new Date(item.created_at).toLocaleString()
      ]))}
    </section>`;
}

function renderAdmins() {
  return `
    <section class="grid">
      <form class="panel span-4" id="admin-form">
        <h2>Add Friend</h2>
        <p>Add the email they will use in Supabase Auth. They can open this dashboard link and edit this server without touching code.</p>
        <div class="field"><label>Email</label><input name="email" type="email" required></div>
        <div class="field">
          <label>Role</label>
          <select name="role">
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
        <div class="actions"><button class="btn primary" type="submit">${icon("UserPlus")} Add Access</button></div>
      </form>
      <div class="panel span-8">
        <h2>Dashboard Members</h2>
        ${table(["Email", "Guild", "Role", "Created"], state.members.map((member) => [member.email, member.guild_id, member.role, new Date(member.created_at).toLocaleString()]))}
      </div>
    </section>`;
}

function renderBots() {
  return `
    <section class="grid">
      <div class="panel span-12">
        <h2>Tacky Bot Status</h2>
        <p>This dashboard is locked to Tacky Bot and will not control other Discord bots.</p>
        ${table(["Guild", "Bot", "Client", "Allowed", "Online", "Last Seen"], state.status ? [[state.status.guild_id, state.status.bot_name || "Tacky", state.status.bot_client_id || "", pill(String(state.status.bot_client_id || "") === tackyBot.clientId ? "Tacky" : "Wrong bot", String(state.status.bot_client_id || "") === tackyBot.clientId), pill(isTackyOnline() ? "yes" : "no", isTackyOnline()), state.status.last_seen_at ? new Date(state.status.last_seen_at).toLocaleString() : "Never"]] : [])}
      </div>
    </section>`;
}

function renderSetup() {
  return `
    <section class="grid">
      <div class="panel span-6">
        <h2>Safe Token Setup</h2>
        <p>Discord tokens stay in the bot host's .env file. The dashboard edits Supabase rows and queues tasks. The bot polls those tasks and talks to Discord.</p>
        <p>After changing the token in Discord Developer Portal, put the new token into bot/.env and restart the bot.</p>
      </div>
      <div class="panel span-6">
        <h2>Discord Category Permissions</h2>
        <p>For both ticket categories, set @everyone to no View Channel. Let Tacky have Manage Channels, View Channel, Send Messages, Read Message History, Attach Files. The bot creates each ticket channel with an allow rule only for the opener plus your Ticket Bot role.</p>
      </div>
      <div class="panel span-12">
        <h2>GitHub Pages</h2>
        <p>Publish the dashboard folder. On first open, paste your Supabase project URL and anon key, then sign in with Supabase Auth email and password.</p>
      </div>
    </section>`;
}

function ticketTypeFields(type, index) {
  return `
    ${field(`Option ${index + 1} Label`, `ticketPanel.types.${index}.label`, type.label)}
    ${field(`Option ${index + 1} Value`, `ticketPanel.types.${index}.value`, type.value)}
    ${field(`Option ${index + 1} Description`, `ticketPanel.types.${index}.description`, type.description)}
    ${field(`Option ${index + 1} Channel Prefix`, `ticketPanel.types.${index}.channelPrefix`, type.channelPrefix)}
    ${field(`Option ${index + 1} Display Prefix`, `ticketPanel.types.${index}.displayPrefix`, type.displayPrefix)}
    ${field(`Option ${index + 1} Emoji`, `ticketPanel.types.${index}.emoji`, type.emoji)}
  `;
}

function field(label, name, value, type = "text") {
  const full = type.includes("full") ? " full" : "";
  if (type.includes("textarea")) {
    return `<div class="field${full}"><label>${html(label)}</label><textarea name="${attr(name)}">${html(value)}</textarea></div>`;
  }
  return `<div class="field${full}"><label>${html(label)}</label><input name="${attr(name)}" value="${attr(value)}"></div>`;
}

function pill(text, good) {
  return `<span class="pill ${good ? "good" : "bad"}">${html(text)}</span>`;
}

function table(headers, rows) {
  if (!rows.length) return `<div class="empty">Nothing to show yet.</div>`;
  return `<div class="table-wrap"><table><thead><tr>${headers.map((item) => `<th>${html(item)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cellContent(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function cellContent(cell) {
  const value = String(cell ?? "");
  return value.startsWith('<span class="pill') ? value : html(value);
}

function taskTable(tasks) {
  return table(["Type", "Status", "Created", "Error"], tasks.map((task) => [task.type, pill(task.status, task.status === "done" || task.status === "pending"), new Date(task.created_at).toLocaleString(), task.error || ""]));
}

function setDeep(object, path, value) {
  const parts = path.split(".");
  let target = object;
  while (parts.length > 1) {
    const part = parts.shift();
    if (/^\d+$/.test(parts[0])) {
      target[part] ||= [];
    } else {
      target[part] ||= {};
    }
    target = target[part];
  }
  const key = parts[0];
  target[key] = value === "true" ? true : value === "false" ? false : value;
}

function configFromForm(form) {
  const next = structuredClone(state.config || defaultConfig);
  for (const [key, value] of new FormData(form).entries()) setDeep(next, key, String(value).trim());
  return next;
}

async function saveConfig(next, message = "Configuration saved") {
  requireTackyOnline();
  state.config = normalizeBrand(deepMerge(defaultConfig, next));
  const { error } = await state.supabase.from("guild_configs").upsert({
    guild_id: state.guildId,
    config: state.config,
    updated_at: new Date().toISOString()
  });
  if (error) throw error;
  toast(message);
  await loadGuild(false);
}

async function queuePanel(panelType) {
  requireTackyOnline();
  const { error } = await state.supabase.from("dashboard_tasks").insert({
    guild_id: state.guildId,
    type: "send_panel",
    payload: { panelType },
    status: "pending"
  });
  if (error) throw error;
  toast(`${panelType} panel queued`);
  await loadGuild(false);
}

async function loadGuild(repaint = true) {
  if (!state.supabase || !state.session) return;
  state.loading = true;
  if (repaint) paint();
  localStorage.setItem("tacky.guildId", state.guildId);
  const [
    configResult,
    statusResult,
    ticketResult,
    commissionResult,
    commandResult,
    taskResult,
    logResult,
    memberResult
  ] = await Promise.all([
    state.supabase.from("guild_configs").select("*").eq("guild_id", state.guildId).maybeSingle(),
    state.supabase.from("bot_status").select("*").eq("guild_id", state.guildId).maybeSingle(),
    state.supabase.from("tickets").select("*").eq("guild_id", state.guildId).order("created_at", { ascending: false }).limit(100),
    state.supabase.from("commissions").select("*").eq("guild_id", state.guildId).order("created_at", { ascending: false }).limit(100),
    state.supabase.from("command_actions").select("*").eq("guild_id", state.guildId).order("family").order("action").limit(1000),
    state.supabase.from("dashboard_tasks").select("*").eq("guild_id", state.guildId).order("created_at", { ascending: false }).limit(50),
    state.supabase.from("audit_logs").select("*").eq("guild_id", state.guildId).order("created_at", { ascending: false }).limit(50),
    state.supabase.from("dashboard_members").select("*").in("guild_id", [state.guildId, "*"]).order("created_at", { ascending: false }).limit(100)
  ]);
  if (configResult.error && configResult.error.code !== "PGRST116") toast(configResult.error.message);
  state.config = normalizeBrand(deepMerge(defaultConfig, configResult.data?.config || { guildId: state.guildId }));
  state.status = statusResult.data || null;
  state.tickets = ticketResult.data || [];
  state.commissions = commissionResult.data || [];
  state.commands = commandResult.data || [];
  state.tasks = taskResult.data || [];
  state.logs = logResult.data || [];
  state.members = memberResult.data || [];
  state.loading = false;
  if (repaint) paint();
}

async function boot() {
  state.supabase = createSupabase();
  if (!state.supabase) {
    paint();
    return;
  }
  const { data } = await state.supabase.auth.getSession();
  state.session = data.session;
  state.supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    if (session) loadGuild();
    else paint();
  });
  if (state.session) await loadGuild(false);
  paint();
}

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    if (event.target.id === "supabase-form") {
      const data = new FormData(event.target);
      localStorage.setItem("tacky.supabaseUrl", String(data.get("url")).trim());
      localStorage.setItem("tacky.supabaseAnon", String(data.get("anon")).trim());
      await boot();
      return;
    }
    if (event.target.id === "auth-form") {
      const data = new FormData(event.target);
      const email = String(data.get("email")).trim();
      const password = String(data.get("password"));
      const result = await state.supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      toast("Signed in");
      return;
    }
    if (event.target.id === "guild-form") {
      state.guildId = String(new FormData(event.target).get("guildId")).trim();
      await loadGuild();
      return;
    }
    if (["config-form", "ticket-panel-form", "commission-panel-form", "verification-panel-form"].includes(event.target.id)) {
      requireTackyOnline();
      await saveConfig(configFromForm(event.target));
      return;
    }
    if (event.target.id === "command-form") {
      requireTackyOnline();
      const data = new FormData(event.target);
      const id = data.get("id");
      const patch = {
        label: String(data.get("label")).trim(),
        required_role_id: String(data.get("required_role_id")).trim() || null,
        enabled: data.get("enabled") === "true",
        ephemeral: data.get("ephemeral") === "true",
        response_title: String(data.get("response_title")).trim(),
        response_body: String(data.get("response_body")).trim(),
        updated_at: new Date().toISOString()
      };
      const { error } = await state.supabase.from("command_actions").update(patch).eq("id", id);
      if (error) throw error;
      toast("Command saved");
      await loadGuild();
      return;
    }
    if (event.target.id === "admin-form") {
      requireTackyOnline();
      const data = new FormData(event.target);
      const { error } = await state.supabase.from("dashboard_members").insert({
        guild_id: state.guildId,
        email: String(data.get("email")).trim().toLowerCase(),
        role: String(data.get("role"))
      });
      if (error) throw error;
      toast("Dashboard access added");
      await loadGuild();
      return;
    }
  } catch (error) {
    toast(error.message || "Something went wrong");
  }
});

document.addEventListener("click", async (event) => {
  const tabButton = event.target.closest("[data-tab]");
  const panelButton = event.target.closest("[data-panel]");
  const commandButton = event.target.closest("[data-command-id]");
  try {
    if (tabButton) {
      state.tab = tabButton.dataset.tab;
      localStorage.setItem("tacky.tab", state.tab);
      paint();
      return;
    }
    if (panelButton) {
      await queuePanel(panelButton.dataset.panel);
      return;
    }
    if (commandButton) {
      state.selectedCommandId = commandButton.dataset.commandId;
      paint();
      return;
    }
    if (event.target.closest("#logout")) {
      await state.supabase.auth.signOut();
      return;
    }
    if (event.target.closest("#refresh")) {
      await loadGuild();
      return;
    }
    if (event.target.closest("#change-supabase")) {
      localStorage.removeItem("tacky.supabaseUrl");
      localStorage.removeItem("tacky.supabaseAnon");
      state.supabase = null;
      state.session = null;
      paint();
    }
  } catch (error) {
    toast(error.message || "Something went wrong");
  }
});

document.addEventListener("input", (event) => {
  if (event.target.id === "command-search") {
    state.commandSearch = event.target.value;
    paint();
  }
});

boot();
