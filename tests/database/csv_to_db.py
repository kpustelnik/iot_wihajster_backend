import csv
import datetime
import os

from pydantic import create_model
from sqlalchemy import DateTime, Boolean

from app_common.database import Base
from app_common.models import *
from app_common.schemas import *
from app_common.models.user import UserType

"""
This file imports data from files to the database.
Files are taken from data folder (must be relative to this file).
All files must end in .csv, others will be ignored.
File name must correspond to the table name.
File name must be lowercase.
Conversion between file name and table name is from snake_case to PascalCase.
Conversion steps:
 * First letter is capitalized
 * Letter after '_' (underscore) is capitalized
 * '_' (underscore) is remove from filename
 * .csv is also removed from the filename
e.g: i_hate_date_times.csv -> IHateDateTimes
Extracted data is passed through BaseModel if it exists.
BaseModel is table name with 'Model' at the end.

IMPORTANT: All tables and models must be imported in
           the app.schemas.__init__.py and app.models.__init__.py
"""
import logging
logger = logging.getLogger('uvicorn.error')

PATH = "data"
files: list[str] = list()
for file in os.listdir(os.path.join(os.path.dirname(__file__), PATH)):
    if file.endswith(".csv"):
        files.append(file)

# make sure the creation order is correct
filenames = [file[:-4] for file in files]  # remove .csv
tableNames = [name.replace("_", " ").title().replace(" ", "") for name in filenames]  # yes
modelNames = [name + "Model" for name in tableNames]

entries: list = list()
postgres_entries: dict[str, list] = dict()
db_table_names = []

for name, filename, tableName, modelName in zip(filenames, files, tableNames, modelNames):
    with open(os.path.join(os.path.dirname(__file__), PATH, filename), 'r', encoding='UTF-8') as file:
        reader = csv.DictReader(file)
        table_entries = list()
        if tableName not in locals():
            raise KeyError(f"{tableName} was not found in the local memory. The name of the file: {filename} might be incorrect."
                            f"Filename must be: lowercase, letter before '_' symbol is capitalized and '_' are removed. Make sure filename matches tablename."
                            f"Table name must be imported in app.models.__init__.py")
        table = locals()[tableName]
        db_table_names.append(table.__table__.name)
        for row in reader:
            attributes = {k: (None if v == "" else v) for k, v in row.items()}
            if modelName in locals():
                model = locals()[modelName]
                # remove id so postgres seq won't be behind
                values = model.model_validate(attributes).model_dump()
                # Filter out keys that are not columns in the table
                table_columns = {c.name for c in table.__table__.columns}
                values = {k: v for k, v in values.items() if k in table_columns}
                entry = table(**values)
            else:  # if model does not exist we do it raw
                for v in table.__table__.c:
                    if isinstance(v.type, DateTime):  # dates are awesome to work with
                        attributes[v.name] = datetime.datetime.strptime(attributes[v.name], "%Y-%m-%d %H:%M:%S")
                    if isinstance(v.type, Boolean):
                        attributes[v.name] = (attributes[v.name] == "True")
                entry = table(**attributes)
            entries.append(entry)
            table_entries.append(entry)
        postgres_entries[name] = table_entries

sorted_table_names = []
# Build a dependency graph
dependencies = {name: [] for name in filenames}
for name, tableName in zip(filenames, tableNames):
    table_obj = locals()[tableName].__table__
    for fk in table_obj.foreign_keys:
        referenced_table_name = fk.column.table.name
        # Convert referenced_table_name back to the 'name' format (e.g., 'user' from 'users')
        # This assumes a consistent naming convention where 'users' table corresponds to 'user' filename
        # A more robust solution might map table names to original filenames
        # For now, let's assume the referenced table name can be found in `filenames`
        # This might need adjustment if table names and filenames don't directly correspond
        # For example, if table is 'users' and filename is 'user', we need to map 'users' to 'user'
        # Let's try to find the corresponding filename for the referenced table
        try:
            # Find the index of the referenced table name in tableNames
            idx = db_table_names.index(referenced_table_name)
            dependencies[name].append(filenames[idx])
        except ValueError:
            # If the referenced table name is not found in our list of tableNames,
            # it might be an external table or a self-referencing FK, or a naming mismatch.
            # For this sorting, we only care about dependencies within the processed files.
            pass

# Perform a topological sort
queue = [name for name in filenames if len(dependencies[name]) == 0]


while queue:
    current_table = queue.pop(0)
    sorted_table_names.append(current_table)

    for name in filenames:
        if current_table in dependencies[name]:
            dependencies[name].remove(current_table)
            if len(dependencies[name]) == 0:
                queue.append(name)

entries_sorted: list[list] = list()
for table_name_key in sorted_table_names:
    if table_name_key in postgres_entries:
        entries_sorted.append(postgres_entries[table_name_key])



