from enum import Enum


class Tags(Enum):
    Device = "Device"


tags_metadata = [
    {
        "name": Tags.Device,
        "description": "Operations with devices.",
    },
]
