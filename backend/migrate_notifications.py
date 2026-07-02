import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from core.database import engine, Base
import models
Base.metadata.create_all(bind=engine)
print('Notifications table created')
import sqlite3
conn = sqlite3.connect(os.path.join(os.path.dirname(__file__), 'sadaksathi.db'))
tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print('Tables:', tables)
conn.close()
