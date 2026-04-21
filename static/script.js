// ============================================================
// script.js — Smart Grocery List Generator
// Handles: adding items, deleting items, chatbot messaging
// ============================================================


// ==============================================================
// PART 1: GROCERY LIST FUNCTIONS (used on index.html)
// ==============================================================

/**
 * addItem()
 * Reads the item name from the input box,
 * sends a POST request to Flask /add,
 * then reloads the page to show the updated list.
 */
async function addItem() {
  const input = document.getElementById("item-input");
  const flash = document.getElementById("flash-msg");

  const itemName = input.value.trim();

  // Basic validation: don't allow empty submission
  if (!itemName) {
    showFlash(flash, "Please enter an item name.", "error");
    return;
  }

  try {
    // Send form data to Flask using fetch (AJAX)
    const formData = new FormData();
    formData.append("item_name", itemName);

    const response = await fetch("/add", {
      method: "POST",
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      // Show success message briefly, then reload page
      showFlash(flash, data.message, "success");
      input.value = "";  // Clear the input box
      setTimeout(() => window.location.reload(), 600);
    } else {
      showFlash(flash, data.message, "error");
    }

  } catch (err) {
    showFlash(flash, "Something went wrong. Please try again.", "error");
    console.error(err);
  }
}


/**
 * deleteItem(itemId)
 * Sends a POST request to Flask /delete/<id>
 * and removes the row from the DOM without full page reload.
 */
async function deleteItem(itemId) {
  try {
    const response = await fetch(`/delete/${itemId}`, { method: "POST" });
    const data = await response.json();

    if (data.success) {
      // Find the table row with id="row-<itemId>" and remove it
      const row = document.getElementById(`row-${itemId}`);
      if (row) {
        // Add a quick fade-out before removing
        row.style.transition = "opacity 0.3s";
        row.style.opacity = "0";
        setTimeout(() => row.remove(), 300);
      }
    }
  } catch (err) {
    console.error("Delete failed:", err);
  }
}


/**
 * showFlash(element, message, type)
 * Shows a coloured flash message above the form.
 * type = "success" or "error"
 */
function showFlash(el, msg, type) {
  el.textContent = msg;
  el.className = `flash ${type}`;  // Sets the correct CSS class
}


// Allow pressing Enter in the add-item input to submit
const itemInput = document.getElementById("item-input");
if (itemInput) {
  itemInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") addItem();
  });
}


// ==============================================================
// PART 2: CHATBOT FUNCTIONS (used on chatbot.html)
// ==============================================================

/**
 * sendMessage()
 * Reads the chat input, shows the user's message in the window,
 * calls the Flask /chat API, and shows the bot's reply.
 */
async function sendMessage() {
  const input = document.getElementById("chat-input");
  const sendBtn = document.getElementById("send-btn");
  const chatWindow = document.getElementById("chat-window");

  const message = input.value.trim();
  if (!message) return;  // Do nothing if empty

  // ---- Show user's message as a chat bubble ----
  appendBubble(chatWindow, message, "user");
  input.value = "";

  // ---- Disable send button while waiting ----
  sendBtn.disabled = true;
  sendBtn.textContent = "...";

  // ---- Show typing indicator ----
  const typingId = "typing-" + Date.now();
  appendTyping(chatWindow, typingId);

  try {
    // Send the message to Flask /chat endpoint as JSON
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message })
    });

    const data = await response.json();

    // Remove typing indicator
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();

    // ---- Show bot's reply ----
    appendBubble(chatWindow, data.reply, "bot");

  } catch (err) {
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();
    appendBubble(chatWindow, "Sorry, something went wrong. Please try again.", "bot");
    console.error(err);
  }

  // Re-enable send button
  sendBtn.disabled = false;
  sendBtn.textContent = "Send ➤";

  // Scroll chat window to bottom so the latest message is visible
  chatWindow.scrollTop = chatWindow.scrollHeight;
}


/**
 * appendBubble(container, text, sender)
 * Creates a chat bubble div and appends it to the chat window.
 * sender = "user" or "bot"
 */
function appendBubble(container, text, sender) {
  const bubble = document.createElement("div");
  bubble.classList.add("chat-bubble");
  bubble.classList.add(sender === "user" ? "user-bubble" : "bot-bubble");

  // Avatar emoji/letter
  const avatar = document.createElement("div");
  avatar.classList.add("bubble-avatar");
  avatar.textContent = sender === "user" ? "U" : "🤖";

  // Message text (preserve newlines from API)
  const textEl = document.createElement("div");
  textEl.classList.add("bubble-text");
  textEl.innerHTML = text.replace(/\n/g, "<br/>");

  bubble.appendChild(avatar);
  bubble.appendChild(textEl);
  container.appendChild(bubble);

  // Auto-scroll to the latest message
  container.scrollTop = container.scrollHeight;
}


/**
 * appendTyping(container, id)
 * Shows an animated "..." typing indicator while waiting for the bot.
 */
function appendTyping(container, id) {
  const bubble = document.createElement("div");
  bubble.classList.add("chat-bubble", "bot-bubble", "typing-indicator");
  bubble.id = id;

  const avatar = document.createElement("div");
  avatar.classList.add("bubble-avatar");
  avatar.textContent = "🤖";

  const textEl = document.createElement("div");
  textEl.classList.add("bubble-text");

  // Three animated dots
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("span");
    dot.classList.add("dot");
    textEl.appendChild(dot);
  }

  bubble.appendChild(avatar);
  bubble.appendChild(textEl);
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}


/**
 * fillQuestion(text)
 * Fills the chat input box with a sample question when clicked.
 */
function fillQuestion(text) {
  const input = document.getElementById("chat-input");
  if (input) {
    input.value = text;
    input.focus();
  }
}


// Allow pressing Enter in the chat input to send a message
const chatInput = document.getElementById("chat-input");
if (chatInput) {
  chatInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") sendMessage();
  });
}
