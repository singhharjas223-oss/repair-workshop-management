const storageKey = "repairTickets";
const views = [...document.querySelectorAll(".view")];
const homeButton = document.querySelector("#home-button");
const customerRequestForm = document.querySelector("#customer-request-form");
const customerLookupForm = document.querySelector("#customer-lookup-form");
const customerResults = document.querySelector("#customer-ticket-results");
const technicianTicketList = document.querySelector("#technician-ticket-list");
const technicianTicketSelect = document.querySelector("#technician-ticket-select");
const technicianForm = document.querySelector("#technician-form");
const progressForm = document.querySelector("#progress-form");
const adminRows = document.querySelector("#admin-ticket-rows");

function loadTickets() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveTickets(tickets) {
  localStorage.setItem(storageKey, JSON.stringify(tickets));
}

function openView(role) {
  views.forEach((view) => {
    view.hidden = view.id !== `${role}-view`;
  });
  homeButton.hidden = role === "home";
  if (role !== "home") refreshAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatMoney(value) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

function getDevice(ticket) {
  return [ticket.deviceType || ticket.device || "Device", ticket.model].filter(Boolean).join(" · ");
}

function getTotal(ticket) {
  return Number(ticket.partsCost || 0) + Number(ticket.labourCost || 0);
}

function setMessage(selector, message) {
  const element = document.querySelector(selector);
  if (element) element.textContent = message;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function addUpdates(ticket) {
  if (!Array.isArray(ticket.updates)) ticket.updates = [];
  return ticket.updates;
}

function updateTicket(id, update) {
  const tickets = loadTickets();
  const ticket = tickets.find((entry) => entry.id === id);
  if (!ticket) return null;
  update(ticket);
  ticket.updatedAt = new Date().toISOString();
  saveTickets(tickets);
  return ticket;
}

function renderCustomerTicket(ticket) {
  const card = createElement("article", "ticket-card");
  const top = createElement("div", "ticket-card-top");
  const title = createElement("strong", "ticket-id", ticket.id);
  const status = createElement("span", "status-badge", ticket.status || "Received");
  top.append(title, status);
  card.append(top);
  card.append(createElement("p", "ticket-device", getDevice(ticket)));
  card.append(createElement("p", "ticket-description", `Problem: ${ticket.problem}`));

  if (ticket.diagnosis) card.append(createElement("p", "ticket-description", `Technician diagnosis: ${ticket.diagnosis}`));
  if (ticket.deadline) card.append(createElement("p", "ticket-description", `Estimated completion: ${ticket.deadline}`));
  if (ticket.partsCost !== undefined || ticket.labourCost !== undefined) {
    card.append(createElement("p", "ticket-description", `Estimate: ${formatMoney(getTotal(ticket))} (parts ${formatMoney(ticket.partsCost)} + labour ${formatMoney(ticket.labourCost)})`));
  }

  if ((ticket.approval || "Pending") === "Pending" && ticket.diagnosis) {
    const actions = createElement("div", "button-row");
    const approveButton = createElement("button", "primary-button", "Approve estimate");
    const rejectButton = createElement("button", "danger-button", "Reject estimate");
    approveButton.type = "button";
    rejectButton.type = "button";
    approveButton.addEventListener("click", () => decideEstimate(ticket.id, "Approved"));
    rejectButton.addEventListener("click", () => decideEstimate(ticket.id, "Rejected"));
    actions.append(approveButton, rejectButton);
    card.append(actions);
  } else if (ticket.approval) {
    card.append(createElement("p", "approval-line", `Estimate ${ticket.approval.toLowerCase()}.`));
  }

  const updates = addUpdates(ticket);
  if (updates.length) {
    const updateHeading = createElement("h3", "updates-heading", "Progress updates");
    const updateList = createElement("ul", "update-list");
    updates.slice().reverse().forEach((update) => {
      const date = update.createdAt ? new Date(update.createdAt).toLocaleString() : "Update";
      updateList.append(createElement("li", "", `${date}: ${update.message} — ${update.status}`));
    });
    card.append(updateHeading, updateList);
  }
  return card;
}

function decideEstimate(id, approval) {
  const ticket = updateTicket(id, (entry) => {
    entry.approval = approval;
    if (approval === "Approved") entry.status = "In Repair";
    if (approval === "Rejected") entry.status = "Estimate rejected";
  });
  if (ticket) {
    lookupCustomerTickets();
    refreshAll();
  }
}

function lookupCustomerTickets() {
  const phone = document.querySelector("#customer-phone-lookup").value.trim();
  const matching = loadTickets().filter((ticket) => ticket.phone === phone);
  customerResults.replaceChildren();
  if (!matching.length) {
    customerResults.append(createElement("p", "empty-state", "No tickets found for that phone number. Check the number and try again."));
    return;
  }
  matching.slice().reverse().forEach((ticket) => customerResults.append(renderCustomerTicket(ticket)));
}

function renderTechnician() {
  const tickets = loadTickets();
  const openTickets = tickets.filter((ticket) => ticket.status !== "Completed" && ticket.status !== "Estimate rejected");
  document.querySelector("#technician-open-count").textContent = `${openTickets.length} open ${openTickets.length === 1 ? "ticket" : "tickets"}`;
  technicianTicketList.replaceChildren();
  technicianTicketSelect.replaceChildren(new Option("Choose a ticket", ""));
  if (!tickets.length) technicianTicketList.append(createElement("p", "empty-state", "No tickets yet. Customer requests will appear here."));

  tickets.slice().reverse().forEach((ticket) => {
    const option = new Option(`${ticket.id} · ${ticket.customerName} · ${getDevice(ticket)}`, ticket.id);
    technicianTicketSelect.append(option);
    const card = createElement("article", "ticket-card");
    const top = createElement("div", "ticket-card-top");
    top.append(createElement("strong", "ticket-id", ticket.id), createElement("span", "status-badge", ticket.status || "Received"));
    card.append(top, createElement("p", "ticket-device", `${ticket.customerName} · ${getDevice(ticket)}`));
    card.append(createElement("p", "ticket-description", ticket.problem));
    card.append(createElement("p", "ticket-description", `Approval: ${ticket.approval || "Pending"} · Estimate: ${formatMoney(getTotal(ticket))}`));
    technicianTicketList.append(card);
  });
}

function renderAdmin() {
  const tickets = loadTickets();
  const active = tickets.filter((ticket) => !["Completed", "Estimate rejected"].includes(ticket.status));
  const pending = tickets.filter((ticket) => (ticket.approval || "Pending") === "Pending" && Boolean(ticket.diagnosis));
  const completed = tickets.filter((ticket) => ticket.status === "Completed");
  document.querySelector("#admin-total").textContent = tickets.length;
  document.querySelector("#admin-active").textContent = active.length;
  document.querySelector("#admin-pending").textContent = pending.length;
  document.querySelector("#admin-completed").textContent = completed.length;
  filterAdminRows();
}

function filterAdminRows() {
  const query = document.querySelector("#admin-search").value.trim().toLowerCase();
  const tickets = loadTickets().filter((ticket) => {
    const haystack = `${ticket.id} ${ticket.customerName} ${ticket.phone} ${ticket.email || ""} ${getDevice(ticket)} ${ticket.problem}`.toLowerCase();
    return haystack.includes(query);
  });
  adminRows.replaceChildren();
  if (!tickets.length) {
    const row = document.createElement("tr");
    const cell = createElement("td", "empty-state", "No matching service tickets.");
    cell.colSpan = 8;
    row.append(cell);
    adminRows.append(row);
    return;
  }
  tickets.slice().reverse().forEach((ticket) => {
    const row = document.createElement("tr");
    [ticket.id, `${ticket.customerName}\n${ticket.phone}${ticket.email ? `\n${ticket.email}` : ""}`, getDevice(ticket), ticket.problem, ticket.status || "Received", ticket.approval || "Pending", formatMoney(getTotal(ticket)), ticket.deadline || "—"].forEach((value) => {
      row.append(createElement("td", "", value));
    });
    adminRows.append(row);
  });
}

function refreshAll() {
  renderTechnician();
  renderAdmin();
}

document.querySelectorAll("[data-open-role]").forEach((button) => {
  button.addEventListener("click", () => openView(button.dataset.openRole));
});
homeButton.addEventListener("click", () => openView("home"));

customerRequestForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(customerRequestForm);
  const ticket = {
    id: `RWM-${Date.now()}`,
    customerName: data.get("customerName").trim(),
    phone: data.get("phone").trim(),
    email: data.get("email").trim(),
    deviceType: data.get("deviceType"),
    model: data.get("model").trim(),
    problem: data.get("problem").trim(),
    diagnosis: "",
    partsUsed: "",
    partsCost: 0,
    labourCost: 0,
    deadline: "",
    approval: "Pending",
    status: "Received",
    updates: [],
    createdAt: new Date().toISOString()
  };
  const tickets = loadTickets();
  tickets.push(ticket);
  saveTickets(tickets);
  customerRequestForm.reset();
  setMessage("#customer-form-message", `Request sent. Your ticket number is ${ticket.id}. Keep it to track your repair.`);
  refreshAll();
});

customerLookupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  lookupCustomerTickets();
});

technicianTicketSelect.addEventListener("change", () => {
  const ticket = loadTickets().find((entry) => entry.id === technicianTicketSelect.value);
  const summary = document.querySelector("#technician-customer-summary");
  if (!ticket) {
    summary.textContent = "Select a ticket to see the customer and device details.";
    return;
  }
  summary.textContent = `${ticket.customerName} · ${ticket.phone}${ticket.email ? ` · ${ticket.email}` : ""}\n${getDevice(ticket)}\nReported problem: ${ticket.problem}`;
  technicianForm.elements.diagnosis.value = ticket.diagnosis || "";
  technicianForm.elements.partsCost.value = Number(ticket.partsCost || 0);
  technicianForm.elements.labourCost.value = Number(ticket.labourCost || 0);
  technicianForm.elements.deadline.value = ticket.deadline || "";
  progressForm.elements.status.value = ticket.status || "Received";
});

technicianForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(technicianForm);
  const id = data.get("ticketId");
  const diagnosis = data.get("diagnosis").trim();
  if (!id || !diagnosis) {
    setMessage("#technician-message", "Select a ticket and enter the technical diagnosis before sending an estimate.");
    return;
  }
  const ticket = updateTicket(id, (entry) => {
    entry.diagnosis = diagnosis;
    entry.partsCost = Number(data.get("partsCost") || 0);
    entry.labourCost = Number(data.get("labourCost") || 0);
    entry.deadline = data.get("deadline");
    entry.approval = "Pending";
    entry.status = "Awaiting customer approval";
  });
  if (ticket) {
    setMessage("#technician-message", `Estimate sent to ${ticket.customerName}. They can review it in the customer portal using ${ticket.phone}.`);
    refreshAll();
    technicianTicketSelect.value = id;
  }
});

progressForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = technicianTicketSelect.value;
  const ticketBeforeUpdate = loadTickets().find((entry) => entry.id === id);
  const message = progressForm.elements.progressReport.value.trim();
  if (!ticketBeforeUpdate) {
    setMessage("#technician-message", "Choose a ticket before saving a progress update.");
    return;
  }
  if (ticketBeforeUpdate.approval !== "Approved") {
    setMessage("#technician-message", "The customer must approve the estimate before repair progress can be reported.");
    return;
  }
  const status = progressForm.elements.status.value;
  const ticket = updateTicket(id, (entry) => {
    entry.status = status;
    if (message) addUpdates(entry).push({ message, status, createdAt: new Date().toISOString() });
  });
  if (ticket) {
    progressForm.reset();
    progressForm.elements.status.value = ticket.status;
    setMessage("#technician-message", "Progress update saved. The customer can see it in the tracking area.");
    refreshAll();
    technicianTicketSelect.value = id;
  }
});

document.querySelector("#admin-search").addEventListener("input", filterAdminRows);
document.querySelector("#export-tickets").addEventListener("click", () => {
  const tickets = loadTickets();
  const headers = ["Ticket ID", "Customer", "Phone", "Email", "Device type", "Model", "Problem", "Diagnosis", "Parts cost", "Labour cost", "Total estimate", "Approval", "Status", "Deadline"];
  const rows = tickets.map((ticket) => [ticket.id, ticket.customerName, ticket.phone, ticket.email || "", ticket.deviceType || ticket.device || "", ticket.model || "", ticket.problem, ticket.diagnosis || "", ticket.partsCost || 0, ticket.labourCost || 0, getTotal(ticket), ticket.approval || "Pending", ticket.status || "Received", ticket.deadline || ""]);
  const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "repair-workshop-tickets.csv";
  link.click();
  URL.revokeObjectURL(url);
});

refreshAll();
