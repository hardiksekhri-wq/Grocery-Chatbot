# ============================================================
# app.py - Main Flask Application
# Smart Grocery List Generator and AI Chatbot
# ============================================================

from flask import Flask, render_template, request, jsonify
import sqlite3
import google.generativeai as genai
from collections import Counter
from datetime import datetime
import os

# ---- Flask app setup ----
app = Flask(__name__)


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# ---- Configure Gemini ----
genai.configure(api_key=GEMINI_API_KEY)

# ---- Gemini model settings ----
generation_config = genai.GenerationConfig(
    temperature=0.3,       # Low = focused, factual answers
    top_p=0.8,             # Controls diversity of output
    max_output_tokens=1000  # Limit response length
)

# ---- Load the Gemini model ----
model = genai.GenerativeModel(
    model_name="gemini-flash-latest",
    generation_config=generation_config
)

# ============================================================
# DATABASE SETUP
# Creates the SQLite database and table if they don't exist
# ============================================================

def init_db():
    """Create the database and grocery_items table."""
    conn = sqlite3.connect("grocery.db")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS grocery_items (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            item_name  TEXT NOT NULL,
            date_added TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

# ============================================================
# HELPER FUNCTIONS
# ============================================================

def get_db_connection():
    """Return a connection to the SQLite database."""
    conn = sqlite3.connect("grocery.db")
    conn.row_factory = sqlite3.Row  # Lets us access columns by name
    return conn


def get_top_items(limit=5):
    """
    Use Python Counter to find the top N most-added grocery items.
    Returns a list of (item_name, count) tuples.
    """
    conn = get_db_connection()
    rows = conn.execute("SELECT item_name FROM grocery_items").fetchall()
    conn.close()

    # Extract item names into a list (lowercased for fair counting)
    item_list = [row["item_name"].lower() for row in rows]

    # Counter counts how many times each item appears
    counter = Counter(item_list)

    # most_common(limit) gives the top items sorted by frequency
    return counter.most_common(limit)


def get_all_items_for_prompt():
    """
    Fetch all saved grocery items to include in the chatbot prompt.
    This lets the AI give personalised advice based on your list.
    """
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT item_name, date_added FROM grocery_items ORDER BY date_added DESC"
    ).fetchall()
    conn.close()
    return [{"item_name": row["item_name"], "date_added": row["date_added"]} for row in rows]

# ============================================================
# ROUTES
# ============================================================

# ---- Home page ----
@app.route("/")
def index():
    """Show the main grocery list page."""
    conn = get_db_connection()
    items = conn.execute(
        "SELECT * FROM grocery_items ORDER BY date_added DESC"
    ).fetchall()
    conn.close()
    return render_template("index.html", items=items)


# ---- Add a grocery item ----
@app.route("/add", methods=["POST"])
def add_item():
    """
    Receive an item name from the form,
    save it to the database with today's date.
    """
    item_name = request.form.get("item_name", "").strip()

    if not item_name:
        return jsonify({"success": False, "message": "Item name cannot be empty."})

    date_added = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    conn = get_db_connection()
    conn.execute(
        "INSERT INTO grocery_items (item_name, date_added) VALUES (?, ?)",
        (item_name, date_added)
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": f"'{item_name}' added successfully!"})


# ---- Delete a grocery item ----
@app.route("/delete/<int:item_id>", methods=["POST"])
def delete_item(item_id):
    """Delete a single grocery item by its ID."""
    conn = get_db_connection()
    conn.execute("DELETE FROM grocery_items WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


# ---- Suggestions page ----
@app.route("/suggestions")
def suggestions():
    """Show the top 5 most frequently added grocery items."""
    top_items = get_top_items(limit=5)
    return render_template("suggestions.html", top_items=top_items)


# ---- Chatbot page ----
@app.route("/chatbot")
def chatbot():
    """Show the chatbot page."""
    return render_template("chatbot.html")


# ---- Chatbot API endpoint ----
@app.route("/chat", methods=["POST"])
def chat():
    """
    Receive a user message, build a context-aware prompt
    (including saved grocery items), send it to Gemini,
    and return the reply as JSON.
    """
    data = request.get_json()
    user_message = data.get("message", "").strip()

    if not user_message:
        return jsonify({"reply": "Please type a message first."})

    # Fetch user's saved grocery items to include in context
    saved_items = get_all_items_for_prompt()

    # Build a text summary of saved items for the prompt
    if saved_items:
        items_text = "\n".join(
            [f"- {item['item_name']} (added on {item['date_added']})" for item in saved_items]
        )
        context_block = f"\nThe user's current grocery list contains:\n{items_text}\n"
    else:
        context_block = "\nThe user has no items saved in their grocery list yet.\n"

    # ---- System prompt for domain restriction ----
    system_prompt = (
        "You are a Grocery Shopping Assistant. "
        "Only answer questions related to grocery items, grocery planning, "
        "shopping lists, food categories, grocery budgets, recipes, and previous grocery orders. "
        "If the user asks anything outside grocery shopping, reply exactly: "
        "I can only help with grocery-related questions."
    )

    # ---- Full prompt sent to Gemini ----
   
    full_prompt = (
        f"{system_prompt}\n"
        f"{context_block}\n"
        f"User question: {user_message}\n"
        "Give a complete answer with full recipe ideas, ingredients, and short steps."
    )
    try:
        response = model.generate_content(full_prompt)
        reply = response.text.strip()
    except Exception as e:
        reply = f"Sorry, I couldn't connect to the AI right now. Error: {str(e)}"

    return jsonify({"reply": reply})


# ============================================================
# RUN THE APP
# ============================================================

if __name__ == "__main__":
    init_db()           # Create DB/table if not already present
    app.run(host="0.0.0.0", port=5000)
