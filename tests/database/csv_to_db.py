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

for name, filename, tableName, modelName in zip(filenames, files, tableNames, modelNames):
    with open(os.path.join(os.path.dirname(__file__), PATH, filename), 'r', encoding='UTF-8') as file:
        reader = csv.DictReader(file)
        table_entries = list()
        for row in reader:
            attributes = {k: (None if v == "" else v) for k, v in row.items()}
            if tableName not in locals():
                raise KeyError(f"{tableName} was not found in the local memory. The name of the file: {filename} might be incorrect."
                               f"Filename must be: lowercase, letter before '_' symbol is capitalized and '_' are removed. Make sure filename matches tablename."
                               f"Table name must be imported in app.models.__init__.py")
            table = locals()[tableName]
            if modelName in locals():
                model = locals()[modelName]
                # remove id so postgres seq won't be behind
                values = model.model_validate(attributes).model_dump()
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
