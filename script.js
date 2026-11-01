const repairForm = document.querySelector("#repair-form");
const ticketList = document.querySelector("#ticket-list");
const formMessage = document.querySelector("#form-message");
const ticketSearch = document.querySelector("#ticket-search");
const statusFilter = document.querySelector("#status-filter");
const ticketCount = document.querySelector("#ticket-count");

function loadTickets() {
  return JSON.parse(localStorage.getItem("repairTickets") || "[]");
}

function matchesSearch(ticket, query) {
  if (!query) {
    return true;
  }

  const haystack = `${ticket.id} ${ticket.customerName} ${ticket.device}`.toLowerCase();
  return haystack.includes(query);
}

function matchesStatus(ticket, selectedStatus) {
  if (!selectedStatus) {
    return true;
  }

  return (ticket.status || "Received") === selectedStatus;
}

function updateDashboardSummary() {
  ticketCount.textContent = String(loadTickets().length);
}

function displayTickets() {
    const tickets = loadTickets();
    updateDashboardSummary();
    const query = (ticketSearch?.value || "").trim().toLowerCase();
    const selectedStatus = statusFilter?.value || "";
    ticketList.replaceChildren();
  
    tickets.filter((ticket) => matchesSearch(ticket, query) && matchesStatus(ticket, selectedStatus)).forEach((ticket) => {
      const item = document.createElement("li");
      const details = document.createElement("p");
      const statusLabel = document.createElement("label");
      const statusSelect = document.createElement("select");
  
      const partsCost = Number(ticket.partsCost || 0);
      const labourCost = Number(ticket.labourCost || 0);
      const totalCost = partsCost + labourCost;
  
      details.textContent =
        `${ticket.id} — ${ticket.customerName} — ${ticket.phone} — ${ticket.device} — ${ticket.problem} — Diagnosis: ${ticket.diagnosis || "Not added yet"} — Parts used: ${ticket.partsUsed || "Not added"} — Parts: ₹${partsCost.toFixed(2)} — Labour: ₹${labourCost.toFixed(2)} — Total: ₹${totalCost.toFixed(2)} — Approval: ${ticket.approval || "Pending"}`;
  
      statusLabel.textContent = "Repair status: ";
      statusSelect.setAttribute("aria-label", `Repair status for ${ticket.id}`);
  
      ["Received", "Diagnosed", "Awaiting Approval", "In Repair", "Completed"].forEach((status) => {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status;
        option.selected = (ticket.status || "Received") === status;
        statusSelect.append(option);
      });
  
      statusSelect.addEventListener("change", () => {
        const updatedTickets = loadTickets();
        const updatedTicket = updatedTickets.find((savedTicket) => savedTicket.id === ticket.id);
  
        if (updatedTicket) {
          updatedTicket.status = statusSelect.value;
          localStorage.setItem("repairTickets", JSON.stringify(updatedTickets));
          displayTickets();
        }
      });
  
      item.append(details, statusLabel, statusSelect);
      ticketList.append(item);
    });
  }

repairForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(repairForm);
  const ticket = {
    id: `RWM-${Date.now()}`,
    customerName: formData.get("customerName").trim(),
    phone: formData.get("phone").trim(),
    device: formData.get("device").trim(),
    problem: formData.get("problem").trim(),
    diagnosis: formData.get("diagnosis").trim(),
    partsUsed: formData.get("partsUsed").trim(),
    partsCost: Number(formData.get("partsCost") || 0),
    labourCost: Number(formData.get("labourCost") || 0),
    approval: formData.get("approval"),
    status: "Received",
    createdAt: new Date().toISOString()
  };

  const tickets = loadTickets();
  tickets.push(ticket);
  localStorage.setItem("repairTickets", JSON.stringify(tickets));

  repairForm.reset();
  formMessage.textContent = `Ticket ${ticket.id} created.`;
  displayTickets();
});

ticketSearch.addEventListener("input", displayTickets);
statusFilter.addEventListener("change", displayTickets);

displayTickets();