import sqlite3

conn = sqlite3.connect("cseps_ledger.sqlite")
cursor = conn.cursor()

# Show tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
print("Tables:", cursor.fetchall())

# Show structure of bids table
cursor.execute("PRAGMA table_info(bids);")
print("Bids Table Structure:", cursor.fetchall())

# Show data
cursor.execute("SELECT * FROM bids;")
rows = cursor.fetchall()

for row in rows:
    print(row)

conn.close()   # ✅ Close at the very end